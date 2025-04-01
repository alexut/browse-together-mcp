# Tele-TS: Playwright Browser Proxy Service

This project provides an HTTP service that acts as a proxy to a persistent Playwright browser instance, allowing remote control of browser automation tasks. It uses Deno and TypeScript.

## Features

*   **Persistent Browser Session:** A single browser instance runs for the lifetime of the service.
*   **Named Tabs:** Control multiple pages (tabs) within the single browser session using unique IDs.
*   **HTTP API:** Interact with the browser using simple JSON commands over HTTP.
*   **Type Safety:** Uses Zod for robust validation of incoming commands.
*   **Page Resilience:** Handles cases where browser tabs might be closed externally.
*   **Persistent Profile:** Uses a persistent browser profile stored in the user's config directory.

## Core Component

*   `browser.ts`: The main proxy service implementation.
*   `types.ts`: Defines the command structures and types using Zod.

## Usage

### Running the Service

The service requires several permissions to run browsers, manage profiles, and listen on the network. Use the Deno task defined in `deno.json`:

```bash
deno task proxy
```

This will start the service, typically listening on `http://localhost:8888`.

### Interacting with the API

Send POST requests to `/api/browser/:pageId` with a JSON body describing the action.

**Example: Navigate to a URL**

```bash
curl -X POST http://localhost:8888/api/browser/myPage \
  -H "Content-Type: application/json" \
  -H "Content-Type: application/json" \
  -d '{"action":"goto","url":"https://example.com"}'
```

**Example: Click an Element**

```bash
curl -X POST http://localhost:8888/api/browser/myPage \
  -H "Content-Type: application/json" \
  -d '{"action":"click","selector":"#submit-button"}'
```

See the [API Reference in `002-browser.md`](docs/002-browser.md#api-reference) for more details.

## Documentation

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

## Development

*   **Run Proxy:** `deno task proxy`
*   **Format Code:** `deno fmt`
*   **Check Dependencies:** `deno check --all browser.ts types.ts`

*(Optional: Add details about `cli.ts` if it's still relevant)*
// The original content about cli.ts can be removed or adapted if needed.