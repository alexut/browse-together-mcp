// browser.ts: Spin up a headful browser and HTTP proxy service for its control

// Import firefox from standard playwright
import { firefox } from "playwright";
// Import chromium from playwright-extra which supports puppeteer plugins
import { chromium } from "playwright-extra";
// Import stealth plugin to avoid detection
import stealth from "puppeteer-extra-plugin-stealth";
import type { BrowserCommand, BrowserContextType, PageType } from "./types.ts";
import { browserCommandSchema } from "./types.ts";
import type { Locator } from "playwright";
import { getLogger, setupLogging } from "./logging.ts";
import { getBrowserLaunchOptions, getConfig } from "./config.ts";

// Initialize logging early
await setupLogging();
const logger = getLogger("browser");

// Load configuration
const config = getConfig();

// Validate API token is configured
if (!config.BROWSER_API_TOKEN) {
  logger.error("BROWSER_API_TOKEN is required but not configured");
  Deno.exit(1);
}

// Single browser context and page management
let browserContext: BrowserContextType | null = null;
const pages: Record<string, PageType> = {};
let isShuttingDown = false;

// Frame locator helper function
function getFrameLocator(page: PageType, selector: string, frame?: string): Locator {
  if (frame) {
    if (frame.includes('>>')) {
      // Handle nested frames: "frame1 >> frame2"
      const frames = frame.split('>>').map(f => f.trim());
      let locator = page.frameLocator(frames[0]);
      for (let i = 1; i < frames.length; i++) {
        locator = locator.frameLocator(frames[i]);
      }
      return locator.locator(selector);
    } else {
      // Single frame
      return page.frameLocator(frame).locator(selector);
    }
  }
  return page.locator(selector);
}

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

  let browserType: typeof firefox | typeof chromium;
  if (config.BROWSER_TYPE === "firefox") {
    browserType = firefox;
  } else {
    // Apply stealth plugin only for Chromium
    // Note: puppeteer-extra-plugin-stealth is compatible with playwright-extra
    chromium.use(stealth());
    browserType = chromium;
  }
  browserContext = await browserType.launchPersistentContext(
    browserOptions.profileDir,
    {
      headless: browserOptions.headless,
      viewport: null, // Maintain this setting as it's not in config
      ignoreDefaultArgs: browserOptions.ignoreDefaultArgs,
      args: browserOptions.args,
    },
  );

  // Create default page
  const defaultPage = await browserContext.newPage();
  pages.default = defaultPage;

  logger.info("Browser initialized with default page");

  return browserContext;
}

// Get or create a page with the given ID
// Function to check if a page is still valid and connected
// Initialize a page with additional stealth improvements
async function initializePage(page: PageType) {
  // Set a consistent User-Agent
  await page.setExtraHTTPHeaders({
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  // In Playwright, we use addInitScript instead of evaluateOnNewDocument
  // But instead of using typed functions that reference browser DOM types,
  // we'll use string literals to avoid TypeScript errors in Deno

  // Override navigator.webdriver
  await page.addInitScript(`
    try {
      Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
        get: () => undefined,
        configurable: true
      });
    } catch (e) {
      console.error('Failed to override navigator.webdriver:', e);
    }
  `);

  // WebGL and Canvas fingerprinting protection - using string scripts to avoid TS errors
  await page.addInitScript(`
    try {
      // Canvas fingerprinting protection
      if (typeof HTMLCanvasElement !== 'undefined') {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
          const context = getContext.call(this, contextType, ...args);
          if (contextType === '2d') {
            const getImageData = context.getImageData;
            context.getImageData = function(...args) {
              const imageData = getImageData.call(this, ...args);
              // Add minor noise to the image data
              for (let i = 0; i < imageData.data.length; i += 4) {
                // Small random adjustments to r,g,b values
                imageData.data[i] += Math.floor(Math.random() * 2);
                imageData.data[i+1] += Math.floor(Math.random() * 2);
                imageData.data[i+2] += Math.floor(Math.random() * 2);
              }
              return imageData;
            };
          }
          return context;
        };
      }

      // WebGL fingerprinting protection
      if (typeof WebGLRenderingContext !== 'undefined') {
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // Spoof vendor and renderer info
          if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
            return 'Intel Inc.';
          }
          if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
            return 'Intel Iris OpenGL Engine';
          }
          return originalGetParameter.call(this, parameter);
        };
      }
    } catch (e) {
      console.error('Failed to apply fingerprinting protections:', e);
    }
  `);

  // Permissions and Feature Policy Handling - using string script to avoid TS errors
  await page.addInitScript(`
    try {
      // Only modify permissions API if it exists
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(parameters) {
          if (parameters.name === 'notifications') {
            // Safe check for Notification API
            if (typeof Notification !== 'undefined') {
              return Promise.resolve({ state: Notification.permission });
            }
          }
          return originalQuery.call(this, parameters);
        };
      }
    } catch (e) {
      console.error('Failed to modify permissions API:', e);
    }
  `);

  return page;
}

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

  // Initialize page with stealth improvements
  await initializePage(page);

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

      case "click": {
        try {
          const locator = getFrameLocator(page, command.selector, command.frame);
          await locator.click(command.params);
          return { success: true };
        } catch (error) {
          if (command.frame && error instanceof Error && error.message.includes("frameLocator")) {
            const availableFrames = page.frames()
              .map(f => f.name() || f.url())
              .filter(name => name)
              .join(', ');
            throw new Error(`Frame "${command.frame}" not found. Available frames: ${availableFrames}`);
          }
          throw error;
        }
      }

      case "fill": {
        try {
          const locator = getFrameLocator(page, command.selector, command.frame);
          await locator.fill(command.text, command.params);
          return { success: true };
        } catch (error) {
          if (command.frame && error instanceof Error && error.message.includes("frameLocator")) {
            const availableFrames = page.frames()
              .map(f => f.name() || f.url())
              .filter(name => name)
              .join(', ');
            throw new Error(`Frame "${command.frame}" not found. Available frames: ${availableFrames}`);
          }
          throw error;
        }
      }

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

      case "content": {
        if (command.frame) {
          // Get content from specific frame
          const frameHandle = page.frame(command.frame) || 
                             page.frame({ name: command.frame }) ||
                             page.frame({ url: new RegExp(command.frame) });
          
          if (frameHandle) {
            const content = await frameHandle.content();
            return { success: true, result: content };
          } else {
            // List available frames for helpful error message
            const availableFrames = page.frames()
              .map(f => f.name() || f.url())
              .filter(name => name)
              .join(', ');
            throw new Error(`Frame "${command.frame}" not found. Available frames: ${availableFrames}`);
          }
        } else {
          // Get main page content
          return { success: true, result: await page.content() };
        }
      }

      case "title":
        return { success: true, result: await page.title() };

      case "evaluate": {
        if (command.frame) {
          const frameHandle = page.frame(command.frame) || 
                             page.frame({ name: command.frame });
          if (frameHandle) {
            const result = await frameHandle.evaluate(command.params.expression);
            return { success: true, result };
          } else {
            // List available frames for helpful error message
            const availableFrames = page.frames()
              .map(f => f.name() || f.url())
              .filter(name => name)
              .join(', ');
            throw new Error(`Frame "${command.frame}" not found. Available frames: ${availableFrames}`);
          }
        } else {
          const result = await page.evaluate(command.params.expression);
          return { success: true, result };
        }
      }

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

  // Check for API token in all API requests
  if (path.startsWith('/api/')) {
    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null;
    
    // Validate token
    if (!token || token !== config.BROWSER_API_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false, 
          error: "Unauthorized: Invalid or missing API token"
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

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
          },
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
