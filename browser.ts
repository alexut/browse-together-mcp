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

// Store browser instances and pages
type BrowserContextType = Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
type PageType = Awaited<ReturnType<BrowserContextType['newPage']>>;

const sessions: Record<string, {
  browser: BrowserContextType;
  pages: Record<string, PageType>;
}> = {};

async function setupBrowser(sessionId = "default") {
  if (sessions[sessionId]) {
    return sessions[sessionId];
  }

  const dirs = xdg.darwin();
  const configDir = join(dirs.config, "playwright", "profile", sessionId);

  // Create the dir, if it doesn't exist
  await Deno.mkdir(configDir, { recursive: true });

  const browser = await chromium.launchPersistentContext(configDir, {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-default-browser-check'
    ],
  });

  const page = await browser.newPage();
  
  sessions[sessionId] = {
    browser,
    pages: { default: page }
  };

  return sessions[sessionId];
}

async function executeCommand(sessionId: string, pageId: string, command: BrowserCommand) {
  // Ensure browser session exists
  const session = await setupBrowser(sessionId);
  
  // Get or create page
  let page = session.pages[pageId];
  if (!page) {
    page = await session.browser.newPage();
    session.pages[pageId] = page;
  }

  // Execute the requested action
  try {
    switch (command.action) {
      case "goto":
        if (!command.url) throw new Error("URL is required for goto");
        return { success: true, result: await page.goto(command.url, command.params) };
      
      case "click":
        if (!command.selector) throw new Error("Selector is required for click");
        await page.click(command.selector, command.params);
        return { success: true };
      
      case "fill":
        if (!command.selector) throw new Error("Selector is required for fill");
        if (command.text === undefined) throw new Error("Text is required for fill");
        await page.fill(command.selector, command.text, command.params);
        return { success: true };
      
      case "screenshot": {
        const buffer = await page.screenshot(command.params);
        return { 
          success: true, 
          result: {
            image: buffer.toString('base64'),
            encoding: 'base64'
          }
        };
      }
      
      case "content":
        return { success: true, result: await page.content() };
      
      case "title":
        return { success: true, result: await page.title() };
      
      case "evaluate":
        if (!command.params?.expression) throw new Error("Expression is required for evaluate");
        return { 
          success: true, 
          result: await page.evaluate(command.params.expression as string) 
        };
      
      case "closePage":
        await page.close();
        delete session.pages[pageId];
        return { success: true };
      
      case "closeBrowser":
        await session.browser.close();
        delete sessions[sessionId];
        return { success: true };
      
      default:
        throw new Error(`Unsupported action: ${command.action}`);
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Start the HTTP server using Deno's built-in server API
const port = 8888;
console.log(`Browser proxy service running on http://localhost:${port}`);

Deno.serve({ port }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  
  // API endpoint to execute commands
  if (path.match(/\/api\/browser\/([^\/]+)\/([^\/]+)/) && method === "POST") {
    const matches = path.match(/\/api\/browser\/([^\/]+)\/([^\/]+)/);
    if (!matches) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid URL format"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const [, sessionId, pageId] = matches;
    
    try {
      const command = await req.json() as BrowserCommand;
      const result = await executeCommand(sessionId || "default", pageId || "default", command);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  // API endpoint to list active sessions and pages
  if (path === "/api/browser/sessions" && method === "GET") {
    const activeSessions = Object.keys(sessions).map(sessionId => ({
      sessionId,
      pages: Object.keys(sessions[sessionId].pages)
    }));
    
    return new Response(JSON.stringify({
      success: true,
      sessions: activeSessions
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Default response for unknown endpoints
  return new Response(JSON.stringify({
    success: false,
    error: "Not found",
    availableEndpoints: [
      "/api/browser/:sessionId/:pageId (POST)",
      "/api/browser/sessions (GET)"
    ]
  }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
});
