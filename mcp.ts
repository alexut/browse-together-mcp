// mcp.ts - FastMCP implementation of the Browse Together MCP server

import { FastMCP } from "fastmcp";
import { z } from "zod";
import { getLogger, setupLogging } from "./logging.ts";
import { getConfig } from "./config.ts";

// Initialize logging early
await setupLogging();
const logger = getLogger("mcp");

// Load configuration
const config = getConfig();
logger.info("MCP server starting", { appEnv: config.APP_ENV });

// Define base URL for browser service
const browserServiceBaseUrl = `http://localhost:${config.PORT}`;
logger.info("Browser service URL", { browserServiceBaseUrl });

// Create FastMCP server instance
const server = new FastMCP({
  name: "browse-together-mcp",
  version: "0.1.0",
});

// Define interfaces for browser API requests and responses
interface BrowserApiResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Browser API helper function (reuse from current implementation)
async function callBrowserApi(
  pageId: string,
  payload: unknown,
): Promise<BrowserApiResponse> {
  const url = `${browserServiceBaseUrl}/api/browser/${pageId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as BrowserApiResponse;
    if (!data.success) {
      throw new Error(data.error || "Unknown error occurred");
    }

    return data;
  } catch (error) {
    logger.error("Browser API call failed", {
      pageId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Define tool input types based on Zod schemas
type GotoInput = {
  pageId: string;
  url: string;
  params?: Record<string, unknown>;
};

type ClickInput = {
  pageId: string;
  selector: string;
  params?: Record<string, unknown>;
};

type FillInput = {
  pageId: string;
  selector: string;
  text: string;
  params?: Record<string, unknown>;
};

type ContentInput = {
  pageId: string;
};

type FetchInput = {
  pageId: string;
  url: string;
  fetchOptions?: Record<string, unknown>;
  responseType: "text" | "json";
};

type ClosePageInput = {
  pageId: string;
};

// Define tools
server.addTool({
  name: "goto",
  description:
    "Navigates a specific browser page (identified by pageId) to a given URL.",
  parameters: z.object({
    pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
    url: z.string().url().describe("The URL to navigate to"),
    params: z.record(z.unknown()).optional().describe(
      "Optional Playwright goto parameters (e.g., waitUntil)",
    ),
  }),
  execute: async (args: GotoInput) => {
    try {
      const payload = {
        action: "goto",
        url: args.url,
        params: args.params,
      };

      await callBrowserApi(args.pageId, payload);
      return `Successfully navigated to ${args.url}`;
    } catch (error) {
      throw new Error(
        `Failed to navigate: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

server.addTool({
  name: "click",
  description:
    "Clicks an element matching the selector on a specific browser page.",
  parameters: z.object({
    pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
    selector: z.string().min(1).describe(
      "CSS or XPath selector for the element to click",
    ),
    params: z.record(z.unknown()).optional().describe(
      "Optional Playwright click parameters",
    ),
  }),
  execute: async (args: ClickInput) => {
    try {
      const payload = {
        action: "click",
        selector: args.selector,
        params: args.params,
      };

      await callBrowserApi(args.pageId, payload);
      return `Successfully clicked element matching selector: ${args.selector}`;
    } catch (error) {
      throw new Error(
        `Failed to click element: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

server.addTool({
  name: "fill",
  description:
    "Fills an input element matching the selector with the provided text on a specific browser page.",
  parameters: z.object({
    pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
    selector: z.string().min(1).describe(
      "CSS or XPath selector for the input element",
    ),
    text: z.string().describe("The text to fill into the element"),
    params: z.record(z.unknown()).optional().describe(
      "Optional Playwright fill parameters",
    ),
  }),
  execute: async (args: FillInput) => {
    try {
      const payload = {
        action: "fill",
        selector: args.selector,
        text: args.text,
        params: args.params,
      };

      await callBrowserApi(args.pageId, payload);
      return `Successfully filled text into element matching selector: ${args.selector}`;
    } catch (error) {
      throw new Error(
        `Failed to fill text: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

server.addTool({
  name: "content",
  description: "Retrieves the full HTML content of a specific browser page.",
  parameters: z.object({
    pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
  }),
  execute: async (args: ContentInput) => {
    try {
      const payload = { action: "content" };
      const result = await callBrowserApi(args.pageId, payload);
      return result.result as string;
    } catch (error) {
      throw new Error(
        `Failed to retrieve content: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

server.addTool({
  name: "fetch",
  description:
    "Executes a fetch request from within the context of a specific browser page, useful for accessing resources requiring session cookies.",
  parameters: z.object({
    pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
    url: z.string().url().describe("The URL to fetch within the page context"),
    fetchOptions: z.record(z.unknown()).optional().describe(
      "Optional fetch options (method, headers, body, etc.)",
    ),
    responseType: z.enum(["text", "json"]).default("text").describe(
      "Expected response type ('text' or 'json')",
    ),
  }),
  execute: async (args: FetchInput) => {
    try {
      // Construct a JavaScript expression to execute in the browser context
      const fetchExpression = `
        fetch(${JSON.stringify(args.url)}, ${
        JSON.stringify(args.fetchOptions || {})
      })
          .then(response => {
            if (!response.ok) {
              throw new Error('HTTP error ' + response.status);
            }
            return response.${args.responseType}();
          })
      `;

      const payload = {
        action: "evaluate",
        params: {
          expression: fetchExpression,
        },
      };

      const result = await callBrowserApi(args.pageId, payload);

      // For JSON, we might want to stringify the result for better readability
      return args.responseType === "json"
        ? JSON.stringify(result.result, null, 2)
        : String(result.result);
    } catch (error) {
      throw new Error(
        `Failed to fetch resource: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

// Type for listPages input (empty object)
type ListPagesInput = Record<string, never>;

server.addTool({
  name: "listPages",
  description: "Lists all active browser pages/tabs.",
  parameters: z.object({}),
  execute: async (_args: ListPagesInput) => {
    try {
      const url = `${browserServiceBaseUrl}/api/browser/pages`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json() as {
        success: boolean;
        pages: string[];
        error?: string;
      };
      if (!data.success) {
        throw new Error(data.error || "Unknown error occurred");
      }

      return `Active pages: ${JSON.stringify(data.pages)}`;
    } catch (error) {
      throw new Error(
        `Failed to list pages: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

server.addTool({
  name: "closePage",
  description: "Closes a specific browser page/tab.",
  parameters: z.object({
    pageId: z.string().min(1).describe(
      "Identifier for the browser page/tab to close",
    ),
  }),
  execute: async (args: ClosePageInput) => {
    try {
      const payload = { action: "closePage" };
      await callBrowserApi(args.pageId, payload);
      return `Successfully closed page: ${args.pageId}`;
    } catch (error) {
      throw new Error(
        `Failed to close page: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
});

// Start the server with STDIO transport
logger.info("Starting Browse Together MCP server with STDIO transport");
server.start({
  transportType: "stdio",
});

logger.info("Browse Together MCP server is ready");
