// mcp.ts - MCP (Model Context Protocol) server implementation
import { z } from "zod";
import {
  McpServer,
  StdioServerTransport,
  type ToolExecutionContext,
} from "npm:@modelcontextprotocol/sdk";
import { getLogger, setupLogging } from "./logging.ts";
import { getConfig } from "./config.ts";

// Initialize logging early
await setupLogging();
const logger = getLogger("mcp");

// Load configuration
const config = getConfig();
logger.info("MCP server starting", { appEnv: config.APP_ENV });

// Set up MCP server
const server = new McpServer({
  info: {
    name: "browse-together-mcp",
    version: "0.1.0",
  },
  capabilities: {
    tools: true,
  },
});

// Define base URL for browser service
const browserServiceBaseUrl = `http://localhost:${config.PORT}`;
logger.info("Browser service URL", { browserServiceBaseUrl });

// Define interfaces for browser API requests and responses
interface BrowserApiResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Tool implementation helper function
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

// Input schemas for tools
const gotoInputSchema = z.object({
  pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
  url: z.string().url().describe("The URL to navigate to"),
  params: z.record(z.unknown()).optional().describe(
    "Optional Playwright goto parameters (e.g., waitUntil)",
  ),
});

const clickInputSchema = z.object({
  pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
  selector: z.string().min(1).describe(
    "CSS or XPath selector for the element to click",
  ),
  params: z.record(z.unknown()).optional().describe(
    "Optional Playwright click parameters",
  ),
});

const fillInputSchema = z.object({
  pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
  selector: z.string().min(1).describe(
    "CSS or XPath selector for the input element",
  ),
  text: z.string().describe("The text to fill into the element"),
  params: z.record(z.unknown()).optional().describe(
    "Optional Playwright fill parameters",
  ),
});

const contentInputSchema = z.object({
  pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
});

const fetchInputSchema = z.object({
  pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
  url: z.string().url().describe("The URL to fetch within the page context"),
  fetchOptions: z.record(z.unknown()).optional().describe(
    "Optional fetch options (method, headers, body, etc.)",
  ),
  responseType: z.enum(["text", "json"]).default("text").describe(
    "Expected response type ('text' or 'json')",
  ),
});

const listPagesInputSchema = z.object({});

const closePageInputSchema = z.object({
  pageId: z.string().min(1).describe(
    "Identifier for the browser page/tab to close",
  ),
});

// Type definitions for tool input schemas
type GotoInput = z.infer<typeof gotoInputSchema>;
type ClickInput = z.infer<typeof clickInputSchema>;
type FillInput = z.infer<typeof fillInputSchema>;
type ContentInput = z.infer<typeof contentInputSchema>;
type FetchInput = z.infer<typeof fetchInputSchema>;
type ListPagesInput = z.infer<typeof listPagesInputSchema>;
type ClosePageInput = z.infer<typeof closePageInputSchema>;

// Define MCP tools

// goto tool
server.defineTool({
  name: "goto",
  description:
    "Navigates a specific browser page (identified by pageId) to a given URL.",
  inputSchema: gotoInputSchema,
  async execute(input: GotoInput, _context: ToolExecutionContext) {
    try {
      const payload = {
        action: "goto",
        url: input.url,
        params: input.params,
      };

      await callBrowserApi(input.pageId, payload);

      return {
        isError: false,
        content: {
          text: `Successfully navigated to ${input.url}`,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to navigate: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// click tool
server.defineTool({
  name: "click",
  description:
    "Clicks an element matching the selector on a specific browser page.",
  inputSchema: clickInputSchema,
  async execute(input: ClickInput, _context: ToolExecutionContext) {
    try {
      const payload = {
        action: "click",
        selector: input.selector,
        params: input.params,
      };

      await callBrowserApi(input.pageId, payload);

      return {
        isError: false,
        content: {
          text:
            `Successfully clicked element matching selector: ${input.selector}`,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to click element: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// fill tool
server.defineTool({
  name: "fill",
  description:
    "Fills an input element matching the selector with the provided text on a specific browser page.",
  inputSchema: fillInputSchema,
  async execute(input: FillInput, _context: ToolExecutionContext) {
    try {
      const payload = {
        action: "fill",
        selector: input.selector,
        text: input.text,
        params: input.params,
      };

      await callBrowserApi(input.pageId, payload);

      return {
        isError: false,
        content: {
          text:
            `Successfully filled text into element matching selector: ${input.selector}`,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to fill text: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// content tool
server.defineTool({
  name: "content",
  description: "Retrieves the full HTML content of a specific browser page.",
  inputSchema: contentInputSchema,
  async execute(input: ContentInput, _context: ToolExecutionContext) {
    try {
      const payload = { action: "content" };

      const result = await callBrowserApi(input.pageId, payload);

      return {
        isError: false,
        content: {
          text: result.result as string,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to retrieve content: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// fetch tool (using evaluate)
server.defineTool({
  name: "fetch",
  description:
    "Executes a fetch request from within the context of a specific browser page, useful for accessing resources requiring session cookies.",
  inputSchema: fetchInputSchema,
  async execute(input: FetchInput, _context: ToolExecutionContext) {
    try {
      // Construct a JavaScript expression to execute in the browser context
      const fetchExpression = `
        fetch(${JSON.stringify(input.url)}, ${
        JSON.stringify(input.fetchOptions || {})
      })
          .then(response => {
            if (!response.ok) {
              throw new Error('HTTP error ' + response.status);
            }
            return response.${input.responseType}();
          })
      `;

      const payload = {
        action: "evaluate",
        params: {
          expression: fetchExpression,
        },
      };

      const result = await callBrowserApi(input.pageId, payload);

      // For JSON, we might want to stringify the result for better readability
      const responseContent = input.responseType === "json"
        ? JSON.stringify(result.result, null, 2)
        : String(result.result);

      return {
        isError: false,
        content: {
          text: responseContent,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to fetch resource: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// listPages tool
server.defineTool({
  name: "listPages",
  description: "Lists all active browser pages/tabs.",
  inputSchema: listPagesInputSchema,
  async execute(_input: ListPagesInput, _context: ToolExecutionContext) {
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

      return {
        isError: false,
        content: {
          text: `Active pages: ${JSON.stringify(data.pages)}`,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to list pages: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// closePage tool
server.defineTool({
  name: "closePage",
  description: "Closes a specific browser page/tab.",
  inputSchema: closePageInputSchema,
  async execute(input: ClosePageInput, _context: ToolExecutionContext) {
    try {
      const payload = { action: "closePage" };

      await callBrowserApi(input.pageId, payload);

      return {
        isError: false,
        content: {
          text: `Successfully closed page: ${input.pageId}`,
        },
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          text: `Failed to close page: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  },
});

// Connect the server using StdioServerTransport
logger.info("Connecting MCP server with StdioServerTransport");
server.connect(new StdioServerTransport());

logger.info("MCP server is ready");
