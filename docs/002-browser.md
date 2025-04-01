# Browser Proxy Service

## Overview

We've built a Playwright proxy service that enables remote control of browser automation via HTTP. This documentation explains what the service does, how it works, and the design decisions behind it.

## Architecture

```
/
├── browser.ts          # Proxy service implementation
├── deno.json           # Configuration with proxy task
└── docs/
    └── 001-browser.md  # This documentation
```

## Core Functionality

The browser proxy service provides:

1. **Remote Browser Control**: Execute Playwright actions through HTTP requests
2. **Session Management**: Multiple browser instances and pages can be controlled independently
3. **Stateful Operation**: Browser sessions persist between commands
4. **Standard HTTP Interface**: Simple JSON-based request/response protocol

## Design Decisions

### Why a Proxy Service?

1. **Language Agnosticism**: Enables non-JavaScript/TypeScript applications to leverage Playwright
2. **Distributed Architecture**: Separates browser automation from application logic
3. **Resource Isolation**: Runs browser processes on dedicated machines/containers
4. **Cross-Platform Bridge**: Allows any HTTP-capable language to use Playwright

### HTTP API Over RPC/WebSockets

We chose a RESTful HTTP API approach because:

1. **Simplicity**: No complex connection management or state synchronization
2. **Universal Support**: Every language and platform has HTTP clients
3. **Familiar Paradigm**: Follows well-understood request/response patterns
4. **Stateless Design**: Each command is self-contained (though browser state persists)

### Deno's Built-in HTTP Server

We use Deno's native `Deno.serve()` API rather than third-party libraries because:

1. **Performance**: Native implementation is highly optimized
2. **Reduced Dependencies**: No external HTTP server packages needed
3. **Future-Proof**: Part of Deno's core APIs, ensuring long-term stability
4. **Simplicity**: Clean, minimal server implementation

### Multi-Session Architecture

The service supports multiple sessions and pages through:

1. **Session Isolation**: Each `:sessionId` creates an independent browser context
2. **Page Management**: Multiple pages can exist within each session
3. **On-Demand Creation**: Sessions and pages are created automatically when referenced
4. **Resource Cleanup**: Explicit commands for closing pages and browsers

## API Reference

### Endpoints

- `POST /api/browser/:sessionId/:pageId`
  - Execute Playwright commands on a specific session/page
  - Creates session/page if they don't exist

- `GET /api/browser/sessions`
  - List all active browser sessions and their pages

### Command Structure

Commands sent to the `/api/browser/:sessionId/:pageId` endpoint follow this structure:

```json
{
  "action": "string",  // The Playwright action to perform
  "selector": "string", // Optional CSS selector for element actions
  "url": "string",      // URL for navigation actions
  "text": "string",     // Text for input actions
  "params": {}          // Optional parameters for the action
}
```

### Supported Actions

- `goto`: Navigate to a URL
- `click`: Click on an element
- `fill`: Enter text into a form field
- `screenshot`: Capture a screenshot
- `content`: Get page HTML content
- `title`: Get page title
- `evaluate`: Execute JavaScript in the page
- `closePage`: Close the current page
- `closeBrowser`: Close the browser session

## Implementation Details

1. **Persistent Profiles**: Browser profiles are stored on disk for persistence
2. **Error Handling**: Comprehensive error catching and reporting
3. **Headful Mode**: Browsers run in visible mode for debugging
4. **Automatic Session Creation**: New sessions are created on first reference
5. **JSON Communication**: All requests and responses use JSON format

## Security Considerations

The service requires several Deno permissions:
- `--allow-read` and `--allow-write`: For profile storage
- `--allow-net`: For HTTP server functionality
- `--allow-run`: For launching browser processes
- `--allow-env`: For environment variable access
- `--allow-sys`: For system information access

## Usage Examples

### Navigate to a Website

```bash
curl -X POST http://localhost:8888/api/browser/mysession/mypage \
  -H "Content-Type: application/json" \
  -d '{"action":"goto","url":"https://example.com"}'
```

### Click an Element

```bash
curl -X POST http://localhost:8888/api/browser/mysession/mypage \
  -H "Content-Type: application/json" \
  -d '{"action":"click","selector":"#submit-button"}'
```

### Take a Screenshot

```bash
curl -X POST http://localhost:8888/api/browser/mysession/mypage \
  -H "Content-Type: application/json" \
  -d '{"action":"screenshot"}'
```

### List Active Sessions

```bash
curl http://localhost:8888/api/browser/sessions
```

## Running the Service

The service can be started using the task defined in `deno.json`:

```bash
deno task proxy
```

This launches the service on port 8888 with all required permissions.
