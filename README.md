# Browse Together MCP: Playwright Browser Proxy with MCP Server

Do you and your AI assistant need access to the same browser session? Want to pull down docs, but you need to be logged in to do so? This is where Browse Together MCP comes in.

This project provides two complementary services for browser automation and co-browsing:

1. A **Browser Proxy Service** that controls a persistent Playwright browser instance via HTTP
2. An **MCP Server** that exposes browser functionality to MCP clients (like Claude Desktop) via the FastMCP framework

Both services are built with Deno and TypeScript and work together seamlessly.

## Features

*   **Multiple Browser Support:** Run with either Chromium (default) or Firefox.
*   **Persistent Browser Session:** A single browser instance runs for the lifetime of the service.
*   **Named Tabs:** Control multiple pages (tabs) within the single browser session using unique IDs.
*   **HTTP API:** Interact with the browser using simple JSON commands over HTTP.
*   **MCP Integration:** Use the browser through Cline, Windsurf, Claude Desktop, or other MCP clients.
*   **Type Safety:** Uses Zod for robust validation of incoming commands.
*   **Page Resilience:** Handles cases where browser tabs might be closed externally.
*   **Persistent Profile:** Uses a persistent browser profile stored in the user's config directory.

Note: Currently supports Mac OS, but can be extended to other platforms with minor changes.

## Core Components

*   **Browser Service**:
    * `browser.ts`: The main browser proxy service implementation
    * `types.ts`: Defines the command structures and types using Zod

*   **MCP Server**:
    * `mcp.ts`: FastMCP implementation that connects to the browser service

## Usage

### Quick Start for Developers

0. **Install Prerequisites**:
   Install Playwright's browser packages (assumes you have `npx` installed):

   ```bash
   # Install all browsers
   npx playwright install

   # Or install specific browsers
   npx playwright install chromium
   npx playwright install firefox
   ```

   Install Deno:

   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```

   See [Deno Installation](https://docs.deno.com/runtime/getting_started/installation) for more details.



1. **Start the Browser Service**:
   ```bash
   deno task proxy
   ```
   This starts the browser proxy on `http://localhost:8888` (or the port specified in your environment)

2. **Configure your MCP Client**:

   ```json
   {
	   "mcpServers": {
		   "browse-together": {
			   "command": "deno",
			   "args": ["run", "-A", "/Users/duane/Projects/browse-together-mcp/mcp.ts"]
	     },
     }
   }
   ```

   You can also start the MCP server directly for testing:

   ```bash
   deno task mcp
   ```

### Browser Selection

You can choose which browser to use by setting the `BROWSER_TYPE` environment variable or using the `--browser-type` flag:

```bash
# Use Firefox via environment variable
BROWSER_TYPE=firefox deno task proxy

# Or via CLI flag
deno task proxy --browser-type firefox
```

### Option 1: Interacting via HTTP API

Send POST requests to `/api/browser/:pageId` with a JSON body describing the action.

**Example: Navigate to a URL**

```bash
curl -X POST http://localhost:8888/api/browser/myTab \
  -H "Content-Type: application/json" \
  -d '{"action":"goto","url":"https://example.com"}'
```

**Example: Click an Element**

```bash
curl -X POST http://localhost:8888/api/browser/myTab \
  -H "Content-Type: application/json" \
  -d '{"action":"click","selector":"#submit-button"}'
```

See the [API Reference in `002-browser.md`](docs/002-browser.md#api-reference) for more details.

### Option 2: Using with an MCP Client

1. Configure the MCP server in your MCP client (e.g. Cline, Windsurf, Claude Desktop) by editing your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browse-together": {
      "command": "/path/to/deno", 
      "args": [
        "run",
        "--allow-read",
        "--allow-net",
        "--allow-env",
        "--allow-sys",
        "/path/to/browse-together-mcp/mcp.ts"
      ],
      "env": {
        "PORT": "8888" 
      }
    }
  }
}
```

2. Use the MCP tools in your client with commands like:

```
Let's browse to jsr.io together.
```

### Available MCP Tools

The MCP server exposes the following tools to clients:

* **goto**: Navigate to a URL
* **click**: Click on an element
* **fill**: Fill a form field
* **content**: Get the page HTML content
* **fetch**: Execute a fetch request in the browser context
* **listPages**: List all active browser pages
* **closePage**: Close a specific page

## Documentation

This project was vibe-coded via a series of documents describing incremental planning steps:

*   [Initial Design Decisions](docs/001-init.md) (Note: Project structure description may be outdated)
*   [Browser Proxy Service Overview (Multi-Session - Historical)](docs/002-browser.md)
*   [Single-Session Architecture Refactor](docs/003-single-session.md)
*   [Type Safety Plan (Zod)](docs/004-type-safety.md)
*   [Page Resilience Plan](docs/005-page-resilience.md)
*   [Libraries Used](docs/006-libraries.md)
*   [Testing Strategy](docs/007-testing.md)
*   [Configuration](docs/008-configuration.md)
*   [Security Considerations](docs/009-security.md)
*   [Deno Best Practices](docs/deno.md)
*   [MCP Server Implementation Plan](docs/017-add-mcp.md)
*   [FastMCP Refactoring](docs/018-fast-mcp.md)

Some of these steps may be outdated or no longer relevant, but are included as a reference and for insight into how the project was built.

See also [vibe-coders.org](https://vibe-coders.org/) for more information about our local vibe-coding group in Sandy, UT.

## Development

*   **Run Browser Proxy:** `deno task proxy`
*   **Run MCP Server:** `deno task mcp` 
*   **Format Code:** `deno fmt`
*   **Check Dependencies:** `deno check --all browser.ts mcp.ts types.ts`

## Architecture

```
+----------------+      +--------------+      +------------------+
|                |      |              |      |                  |
| Cline/LLM      | ---- | MCP Server   | ---- | Browser Service  |
| (MCP Client)   |      | (mcp.ts)     | HTTP | (browser.ts)     |
|                |      |              |      |                  |
+----------------+      +--------------+      +------------------+
                               |                       |
                          FastMCP API            Playwright API
                               |                       |
                           STDIO/SSE            Chromium Browser
```

The system works as follows:

1. The **Browser Service** (`browser.ts`) manages a persistent Chromium browser instance using Playwright
2. The **MCP Server** (`mcp.ts`) provides a standard MCP interface using FastMCP
3. The MCP server forwards commands to the browser service via HTTP
4. **MCP Clients** like Claude Desktop can use all browser functionality through simple tool calls
