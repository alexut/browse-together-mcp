// browser-proxy.ts
import { chromium, firefox } from "playwright";
import type { BrowserCommand, BrowserContextType, PageType } from "./types.ts";
import { browserCommandSchema } from "./types.ts";
import { getLogger, setupLogging } from "./logging.ts";
import { getConfig, getBrowserLaunchOptions } from "./config.ts";

// Initialize logging early
await setupLogging();
const logger = getLogger("browser");

const config = getConfig();

// Single browser context and page management
let browserContext: BrowserContextType | null = null;
const pages: Record<string, PageType> = {};
let isShuttingDown = false;

// Setup the browser once at startup
async function setupBrowser() {
  if (browserContext) {
    return browserContext;
  }

  // Get browser launch options from the configuration
  const browserOptions = getBrowserLaunchOptions(config);

  // Create the dir, if it doesn't exist
  await Deno.mkdir(browserOptions.profileDir, { recursive: true });

  logger.info("Starting browser context", { type: config.BROWSER_TYPE });

  const browserType = config.BROWSER_TYPE === 'firefox' ? firefox : chromium;
  browserContext = await browserType.launchPersistentContext(
    browserOptions.profileDir,
    {
      headless: browserOptions.headless,
      viewport: null, // Maintain this setting as it's not in config
      ignoreDefaultArgs: browserOptions.ignoreDefaultArgs,
      args: browserOptions.args,
    }
  );

  // Create default page
  const defaultPage = await browserContext.newPage();
  pages.default = defaultPage;

  logger.info("Browser initialized with default page");

  return browserContext;
}

// Get or create a page with the given ID
// Function to check if a page is still valid and connected
async function isPageValid(page: PageType): Promise<boolean> {
  try {
    // Perform a minimal evaluation to check if the page is still connected
    await page.evaluate("1");
    return true;
  } catch (_error) {
    return false;
  }
}

async function getOrCreatePage(pageId: string) {
  if (!browserContext) {
    throw new Error("Browser context not initialized");
  }

  // Check if the page exists and is still connected
  if (pages[pageId]) {
    if (await isPageValid(pages[pageId])) {
      return pages[pageId];
    }

    console.log(`Page ${pageId} was closed externally, cleaning up reference`);
    delete pages[pageId];
    // Continue to create a new page
  }

  // Create a new page
  console.log(`Creating new page: ${pageId}`);
  const page = await browserContext.newPage();

  // Add event listener for close events
  page.on("close", () => {
    console.log(`Page ${pageId} closed event detected`);
    delete pages[pageId];
  });

  pages[pageId] = page;
  return page;
}

// Execute a command on a specific page
async function executeCommand(pageId: string, command: BrowserCommand) {
  if (isShuttingDown) {
    return {
      success: false,
      error: "Server is shutting down",
    };
  }

  try {
    // Get or create the page
    const page = await getOrCreatePage(pageId);

    // Execute the requested action based on command type
    // With our discriminated union, TypeScript knows which properties exist for each action
    switch (command.action) {
      case "goto":
        return {
          success: true,
          result: await page.goto(command.url, command.params),
        };

      case "click":
        await page.click(command.selector, command.params);
        return { success: true };

      case "fill":
        await page.fill(command.selector, command.text, command.params);
        return { success: true };

      case "screenshot": {
        const buffer = await page.screenshot(command.params);
        return {
          success: true,
          result: {
            image: buffer.toString("base64"),
            encoding: "base64",
          },
        };
      }

      case "content":
        return { success: true, result: await page.content() };

      case "title":
        return { success: true, result: await page.title() };

      case "evaluate":
        return {
          success: true,
          result: await page.evaluate(command.params.expression),
        };

      case "closePage":
        await page.close();
        delete pages[pageId];
        return { success: true };

      default: {
        // This code should be unreachable due to our Zod validation and TypeScript's exhaustiveness checking
        // The exhaustive check ensures we've handled all possible action types from our union
        // We need to cast to unknown first before asserting a type with properties to avoid the TS error
        const unknownCommand = command as unknown as { action: string };
        throw new Error(`Unsupported action: ${unknownCommand.action}`);
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Gracefully shutdown the browser and server
async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  console.log("Shutting down browser proxy service...");
  isShuttingDown = true;

  // Close all pages
  for (const pageId in pages) {
    try {
      console.log(`Closing page: ${pageId}`);
      await pages[pageId].close();
      delete pages[pageId];
    } catch (error) {
      console.error(`Error closing page ${pageId}:`, error);
    }
  }

  // Close browser context
  if (browserContext) {
    try {
      console.log("Closing browser context");
      await browserContext.close();
      browserContext = null;
    } catch (error) {
      console.error("Error closing browser context:", error);
    }
  }

  console.log("Browser proxy service shutdown complete");

  // Exit process after a brief delay to allow logs to be written
  setTimeout(() => Deno.exit(0), 500);
}

// Register shutdown hook for graceful termination
Deno.addSignalListener("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await shutdown();
});

Deno.addSignalListener("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await shutdown();
});

// Initialize browser on startup
logger.info("Browser proxy service starting", { appEnv: config.APP_ENV });
await setupBrowser();

// Start the HTTP server using Deno's built-in server API
const port = config.PORT;
logger.info("Browser proxy service running", {
  port,
  url: `http://localhost:${port}`,
});

Deno.serve({ port }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // API endpoint to execute commands on a specific page
  if (path.match(/\/api\/browser\/([^\/]+)/) && method === "POST") {
    const matches = path.match(/\/api\/browser\/([^\/]+)/);
    if (!matches) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid URL format",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const [, pageId] = matches;

    try {
      const requestBody = await req.json();

      // Validate the request body against our schema
      const parseResult = browserCommandSchema.safeParse(requestBody);

      if (!parseResult.success) {
        // If validation fails, return an error response with detailed validation issues
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid command format",
            issues: parseResult.error.issues,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Extract the validated command data
      const command = parseResult.data;
      const result = await executeCommand(pageId || "default", command);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // API endpoint to list active pages
  if (path === "/api/browser/pages" && method === "GET") {
    return new Response(
      JSON.stringify({
        success: true,
        pages: Object.keys(pages),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Default response for unknown endpoints
  return new Response(
    JSON.stringify({
      success: false,
      error: "Not found",
      availableEndpoints: [
        "/api/browser/:pageId (POST)",
        "/api/browser/pages (GET)",
      ],
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }
  );
});
