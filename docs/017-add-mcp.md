# Plan: MCP Server Implementation (`mcp.ts`)

This document outlines the plan for implementing an MCP (Model Context Protocol) server in Deno/TypeScript (`mcp.ts`). This server will act as an interface to the existing Playwright browser proxy service (`browser.ts`), allowing MCP clients (like Claude Desktop) to control browser actions.

## 1. Goal

Create a standalone Deno MCP server (`mcp.ts`) that exposes browser control functionality (navigation, interaction, content retrieval) as MCP tools. This server will communicate with the `browser.ts` service via its HTTP API.

## 2. Dependencies

*   **Deno Runtime:** The execution environment.
*   **`@modelcontextprotocol/sdk`:** The official TypeScript SDK for building MCP servers. (Will need to be added via `deno add npm:@modelcontextprotocol/sdk`)
*   **`zod`:** For defining input schemas for MCP tools (already in `deno.json`).
*   **`@canadaduane/ts-env`:** For configuration management (already in `deno.json`).
*   **`@logtape/logtape`:** For logging (already in `deno.json`).

## 3. Configuration

*   The `mcp.ts` server will reuse the existing configuration system defined in `config.ts`.
*   It will read relevant environment variables (e.g., `PORT` for the `browser.ts` service, `LOG_LEVEL`, `APP_ENV`).
*   The `getConfig` function from `config.ts` will be used to load and validate the configuration.
*   Logging will be initialized using `setupLogging` from `logging.ts`.

## 4. MCP Server Setup (`mcp.ts`)

*   Import necessary modules: `McpServer` from `@modelcontextprotocol/sdk`, `zod`, `getConfig`, `setupLogging`, `getLogger`.
*   Initialize logging early using `setupLogging()`.
*   Load configuration using `getConfig()`.
*   Instantiate `McpServer` with appropriate server info (name, version) and capabilities (primarily `tools`).
*   Define the base URL for the `browser.ts` service (e.g., `http://localhost:${config.PORT}`).
*   Implement the main logic to register tools and connect the server using a transport (likely `StdioServerTransport` for easy integration with clients like Claude Desktop).

## 5. Tool Implementation Strategy

*   **Mapping:** Each MCP tool will correspond to an HTTP POST request to the `browser.ts` API (`/api/browser/:pageId`).
*   **`pageId` Management:** The concept of a browser page/tab needs to be managed. Each tool requiring page interaction will accept a `pageId` string as a mandatory argument. The MCP client/LLM will be responsible for providing a consistent `pageId` for operations within the same logical "tab".
*   **Input Validation:** Use `zod` schemas to define the `inputSchema` for each MCP tool, ensuring type safety and clear requirements for clients.
*   **HTTP Client:** Use Deno's built-in `fetch` API to send requests to `browser.ts`.
*   **Response Handling:** Parse the JSON response from `browser.ts`. If `success` is `true`, return the relevant data in the MCP tool result format. If `success` is `false`, return an MCP tool error result (`isError: true`) with the error message from `browser.ts`.

## 6. Tool Definitions

The following tools will be implemented:

### a. `goto`

*   **Description:** Navigates a specific browser page (identified by `pageId`) to a given URL.
*   **Input Schema (`zod`):**
    ```typescript
    z.object({
      pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
      url: z.string().url().describe("The URL to navigate to"),
      params: z.record(z.unknown()).optional().describe("Optional Playwright goto parameters (e.g., waitUntil)")
    })
    ```
*   **Action:**
    1.  Construct payload: `{ action: "goto", url: input.url, params: input.params }`.
    2.  Send POST request to `http://localhost:${config.PORT}/api/browser/${input.pageId}` with the payload.
*   **Return:** `McpSchema.CallToolResult` with text content indicating success or failure.

### b. `click`

*   **Description:** Clicks an element matching the selector on a specific browser page.
*   **Input Schema (`zod`):**
    ```typescript
    z.object({
      pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
      selector: z.string().min(1).describe("CSS or XPath selector for the element to click"),
      params: z.record(z.unknown()).optional().describe("Optional Playwright click parameters")
    })
    ```
*   **Action:**
    1.  Construct payload: `{ action: "click", selector: input.selector, params: input.params }`.
    2.  Send POST request to `http://localhost:${config.PORT}/api/browser/${input.pageId}` with the payload.
*   **Return:** `McpSchema.CallToolResult` with text content indicating success or failure.

### c. `fill`

*   **Description:** Fills an input element matching the selector with the provided text on a specific browser page.
*   **Input Schema (`zod`):**
    ```typescript
    z.object({
      pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
      selector: z.string().min(1).describe("CSS or XPath selector for the input element"),
      text: z.string().describe("The text to fill into the element"),
      params: z.record(z.unknown()).optional().describe("Optional Playwright fill parameters")
    })
    ```
*   **Action:**
    1.  Construct payload: `{ action: "fill", selector: input.selector, text: input.text, params: input.params }`.
    2.  Send POST request to `http://localhost:${config.PORT}/api/browser/${input.pageId}` with the payload.
*   **Return:** `McpSchema.CallToolResult` with text content indicating success or failure.

### d. `content`

*   **Description:** Retrieves the full HTML content of a specific browser page.
*   **Input Schema (`zod`):**
    ```typescript
    z.object({
      pageId: z.string().min(1).describe("Identifier for the browser page/tab")
    })
    ```
*   **Action:**
    1.  Construct payload: `{ action: "content" }`.
    2.  Send POST request to `http://localhost:${config.PORT}/api/browser/${input.pageId}` with the payload.
*   **Return:** `McpSchema.CallToolResult` with the HTML content in a `text` field if successful.

### e. `fetch` (Requires `evaluate` in `browser.ts`)

*   **Description:** Executes a `fetch` request from within the context of a specific browser page, useful for accessing resources requiring session cookies.
*   **Input Schema (`zod`):**
    ```typescript
    z.object({
      pageId: z.string().min(1).describe("Identifier for the browser page/tab"),
      url: z.string().url().describe("The URL to fetch within the page context"),
      fetchOptions: z.record(z.unknown()).optional().describe("Optional fetch options (method, headers, body, etc.)"),
      responseType: z.enum(["text", "json"]).default("text").describe("Expected response type ('text' or 'json')")
    })
    ```
*   **Action:**
    1.  Construct the JavaScript expression to execute in the browser. This needs careful escaping and handling of options. Example for text:
        ```javascript
        `fetch(${JSON.stringify(input.url)}, ${JSON.stringify(input.fetchOptions || {})}).then(response => {
          if (!response.ok) {
            throw new Error('HTTP error ' + response.status);
          }
          return response.text(); // or response.json() based on responseType
        })`
        ```
    2.  Construct payload: `{ action: "evaluate", params: { expression: constructedExpression } }`.
    3.  Send POST request to `http://localhost:${config.PORT}/api/browser/${input.pageId}` with the payload.
*   **Return:** `McpSchema.CallToolResult` with the fetched content (as text or stringified JSON) in a `text` field if successful.

## 7. Error Handling

*   Wrap `fetch` calls to `browser.ts` in `try...catch` blocks.
*   Handle network errors (e.g., `browser.ts` not running).
*   Check the `success` field in the JSON response from `browser.ts`.
*   If `success` is `false` or a network error occurs, return an `McpSchema.CallToolResult` with `isError: true` and the relevant error message in the `text` content.
*   Log errors using the configured logger.

## 8. Running the Server

*   Add a new task to `deno.json` for running the MCP server:
    ```json
    "tasks": {
      // ... existing tasks ...
      "mcp": "deno run --allow-read --allow-net --allow-env mcp.ts"
    }
    ```
*   Run using `deno task mcp`.

## 9. Integration with MCP Clients (e.g., Claude Desktop)

*   The server will use `StdioServerTransport` by default.
*   To configure in `claude_desktop_config.json`, the `command` would be `deno` and `args` would include `run`, permissions flags (`--allow-read`, `--allow-net`, `--allow-env`), and the path to `mcp.ts`. Example:
    ```json
    {
      "mcpServers": {
        "browse-together": {
          "command": "/path/to/deno", // Or just "deno" if in PATH
          "args": [
            "run",
            "--allow-read", // For config/env
            "--allow-net",  // To talk to browser.ts
            "--allow-env",  // For config
            "/absolute/path/to/browse-together-mcp/mcp.ts"
          ],
          "env": {
            // Optional: Override env vars if needed
            "PORT": "8888"
          }
        }
      }
    }
    ```

## 10. Future Considerations

*   **Page Lifecycle Management:** Add tools to explicitly open/close pages (`openPage`, `closePage`). `browser.ts` already has `closePage`.
*   **List Pages:** Add a tool to list active `pageId`s by querying `browser.ts` (`/api/browser/pages`).
*   **More Sophisticated Fetch:** Handle binary responses, more robust error details from fetch.
*   **Resource Exposure:** Expose the list of active pages as an MCP resource.
*   **SSE Transport:** Consider adding support for SSE transport if remote access is needed.