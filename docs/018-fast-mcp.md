# Refactoring the MCP Server with FastMCP

## Analysis of Current Implementation

The current MCP server implementation in `mcp.ts` uses the `@modelcontextprotocol/sdk` package, which is causing compatibility issues with Deno. Key aspects of the current implementation:

1. **Server Structure**:
   - Uses `McpServer` and `StdioServerTransport` from `@modelcontextprotocol/sdk`
   - Creates server with metadata and capabilities
   - Defines tools with name, description, input schema, and execute functions
   - Uses Zod for input validation

2. **Tool Implementation Pattern**:
   - All tools follow a similar pattern:
     - They define input schemas using Zod
     - Have execute functions with try/catch blocks
     - Return standardized responses with `isError` and `content` properties
     - Most tools interact with the browser service via `callBrowserApi`

3. **Communication with Browser Service**:
   - A utility function `callBrowserApi` manages HTTP requests to the browser proxy service
   - Each tool constructs a payload specific to its action (goto, click, fill, etc.)
   - Error handling is consistent across all tool implementations

4. **Current Tools**:
   - `goto`: Navigate to a URL
   - `click`: Click on an element
   - `fill`: Fill an input field
   - `content`: Get page HTML content
   - `fetch`: Execute a fetch request in the browser context
   - `listPages`: List all active browser pages
   - `closePage`: Close a specific page

## FastMCP Framework Analysis

FastMCP offers several advantages over the current implementation:

1. **Simplified API**: More straightforward tool definitions
2. **Built-in Features**: Authentication, sessions, error handling, etc.
3. **Transport Options**: Beyond STDIO, also supports SSE for web-based use
4. **Better Schema Support**: Works with multiple validation libraries
5. **No Compatibility Issues**: Better for Deno compatibility

## Refactoring Plan

Based on the analysis, a **complete rewrite** is recommended over incremental updates. The structure will be similar, but the implementation details will change significantly to align with FastMCP patterns.

### 1. Project Dependencies

Update `deno.json` to include FastMCP:

```json
{
  "imports": {
    "fastmcp": "npm:fastmcp@^1.0.0",
    // Keep other dependencies
  }
}
```

### 2. Server Implementation

Create a new implementation in `fast-mcp.ts`:

```typescript
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { getLogger, setupLogging } from "./logging.ts";
import { getConfig } from "./config.ts";

// Initialize logging and configuration
await setupLogging();
const logger = getLogger("mcp");
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

// Browser API helper function (reuse from current implementation)
async function callBrowserApi(pageId: string, payload: unknown) {
  // (Implementation remains the same)
}

// Define tools
server.addTool({
  name: "goto",
  description: "Navigates a specific browser page (identified by pageId) to a given URL.",
  parameters: z.object({
    pageId: z.string().min(1),
    url: z.string().url(),
    params: z.record(z.unknown()).optional(),
  }),
  execute: async (args) => {
    try {
      const payload = {
        action: "goto",
        url: args.url,
        params: args.params,
      };
      
      await callBrowserApi(args.pageId, payload);
      return `Successfully navigated to ${args.url}`;
    } catch (error) {
      throw new Error(`Failed to navigate: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Add remaining tools following the same pattern
// click, fill, content, fetch, listPages, closePage

// Start the server
server.start({
  transportType: "stdio",
});

logger.info("MCP server is ready");
```

### 3. Error Handling

FastMCP provides simpler error handling - throwing errors in the `execute` function automatically handles error responses to clients.

### 4. Configuration Updates

Update `deno.json` to add a task for the new implementation:

```json
{
  "tasks": {
    "fastmcp": "deno run --allow-read --allow-net --allow-env fast-mcp.ts",
    // Keep existing tasks
  }
}
```

### 5. Testing Plan

1. Implement the new server
2. Test each tool functionality
3. Compare responses with the original implementation
4. Update the MCP configuration to use the new server
5. Replace the original implementation if all tests pass

## Implementation Timeline

1. **Phase 1**: Create initial FastMCP implementation with core tools
   - Estimated time: 1-2 hours
   - Milestone: Working `goto` and `content` tools

2. **Phase 2**: Implement remaining tools and error handling
   - Estimated time: 1-2 hours
   - Milestone: Complete tool set

3. **Phase 3**: Testing and refinement
   - Estimated time: 1-2 hours
   - Milestone: Verified functionality with MCP clients

## Conclusion

The refactoring approach focuses on creating a new implementation using FastMCP while maintaining the same functionality and tool definitions. The primary benefits will be:

1. Better compatibility with Deno
2. Simplified code structure
3. Enhanced error handling
4. More robust MCP protocol compliance

The implementation complexity is moderate, primarily involving adapting the existing tool logic to the FastMCP patterns. The core browser interaction logic will remain largely unchanged.
