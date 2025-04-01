// browser-proxy.ts
import { chromium } from "playwright";
import xdg from "@folder/xdg";
import { join } from "std/path";

interface BrowserCommand {
  action: string;
  params?: Record<string, unknown>;
  selector?: string;
  url?: string;
  text?: string;
  timeout?: number;
}

// Define types for browser context and pages
type BrowserContextType = Awaited<
  ReturnType<typeof chromium.launchPersistentContext>
>;
type PageType = Awaited<ReturnType<BrowserContextType["newPage"]>>;

// Single browser context and page management
let browserContext: BrowserContextType | null = null;
const pages: Record<string, PageType> = {};
let isShuttingDown = false;

// Setup the browser once at startup
async function setupBrowser() {
  if (browserContext) {
    return browserContext;
  }

  const dirs = xdg.darwin();
  const configDir = join(dirs.config, "playwright", "profile");

  // Create the dir, if it doesn't exist
  await Deno.mkdir(configDir, { recursive: true });

  console.log("Starting browser context...");

  browserContext = await chromium.launchPersistentContext(configDir, {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-default-browser-check",
    ],
  });

  // Create default page
  const defaultPage = await browserContext.newPage();
  pages.default = defaultPage;

  console.log("Browser initialized with default page");

  return browserContext;
}

// Get or create a page with the given ID
async function getOrCreatePage(pageId: string) {
  if (!browserContext) {
    throw new Error("Browser context not initialized");
  }

  // Return existing page if it exists
  if (pages[pageId]) {
    return pages[pageId];
  }

  // Create a new page
  console.log(`Creating new page: ${pageId}`);
  const page = await browserContext.newPage();
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

    // Execute the requested action
    switch (command.action) {
      case "goto":
        if (!command.url) throw new Error("URL is required for goto");
        return {
          success: true,
          result: await page.goto(command.url, command.params),
        };

      case "click":
        if (!command.selector) {
          throw new Error("Selector is required for click");
        }
        await page.click(command.selector, command.params);
        return { success: true };

      case "fill":
        if (!command.selector) throw new Error("Selector is required for fill");
        if (command.text === undefined) {
          throw new Error("Text is required for fill");
        }
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
        if (!command.params?.expression) {
          throw new Error("Expression is required for evaluate");
        }
        return {
          success: true,
          result: await page.evaluate(command.params.expression as string),
        };

      case "closePage":
        await page.close();
        delete pages[pageId];
        return { success: true };

      default:
        throw new Error(`Unsupported action: ${command.action}`);
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
  console.log("Received SIGINT signal");
  await shutdown();
});

Deno.addSignalListener("SIGTERM", async () => {
  console.log("Received SIGTERM signal");
  await shutdown();
});

// Initialize browser on startup
console.log("Initializing browser proxy service...");
await setupBrowser();

// Start the HTTP server using Deno's built-in server API
const port = 8888;
console.log(`Browser proxy service running on http://localhost:${port}`);

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
        },
      );
    }

    const [, pageId] = matches;

    try {
      const command = await req.json() as BrowserCommand;
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
        },
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
      },
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
    },
  );
});
