# Security Token Implementation

This document outlines the implementation plan for adding authentication and authorization to both the Browser Service HTTP API and the MCP Server components of the Browse Together MCP project, addressing the first mitigation strategy outlined in [009-security.md](./009-security.md).

## Goals

1. Protect the Browser Service HTTP API with a secret token/API key
2. Add authentication to the MCP Server using FastMCP's built-in authentication support
3. Ensure both services require tokens for launch and access
4. Provide a simple yet secure mechanism for token generation and validation

## Architecture Overview

We will implement a token-based authentication system with the following characteristics:

1. **Static Tokens**: Initially use static, pre-configured tokens for simplicity
2. **Required for Launch**: Both services will refuse to start without valid tokens
3. **Required for Access**: All API calls will require tokens for authentication
4. **Configuration Integration**: Token configuration via environment variables and CLI arguments
5. **Single Token**: A single token used by the Browser Proxy Service to authenticate browser API calls

## Implementation Plan

### 1. Configuration Updates

Add new token-related configuration option to `config.ts`:

```typescript
// Add to envSchema in config.ts
const envSchema = z.object({
  // Existing config options...
  
  // New token-related option
  BROWSER_API_TOKEN: envVar(z.string().min(32), {
    // No default - must be explicitly provided
    description: "Secret token for authenticating with the Browser Proxy Service API",
  }),
});

// Add to configMapping for CLI args
export const configMapping: [keyof EnvConfig, string, string | undefined][] = [
  // Existing mappings...
  ["BROWSER_API_TOKEN", "browser-api-token", undefined], // No short alias for security
];
```

### 2. Browser Service Authentication

Update `browser.ts` to implement token validation:

#### 2.1 Token Validation in Request Handler

Add token validation to the Deno.serve request handler:

```typescript
// In browser.ts

// Add to imports
import { getConfig } from "./config.ts";

// Get config
const config = getConfig();

// Validate API token is configured
if (!config.BROWSER_API_TOKEN) {
  logger.error("BROWSER_API_TOKEN is required but not configured");
  Deno.exit(1);
}

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

  // Continue with existing API handling...
```

### 3. MCP Server Authentication

Update `mcp.ts` to implement token validation:

#### 3.1 Token Validation

Require the `BROWSER_API_TOKEN` to be configured in the environment before starting the MCP server:

```typescript
// In mcp.ts

// Validate Browser API token is configured
if (!config.BROWSER_API_TOKEN) {
  logger.error("BROWSER_API_TOKEN is required but not configured");
  Deno.exit(1);
}
```

#### 3.2 Browser API Client Authentication

Update the `callBrowserApi` function to include the token in requests to the Browser Service:

```typescript
// In mcp.ts - Update callBrowserApi function
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
        "Authorization": `Bearer ${config.BROWSER_API_TOKEN}`, // Add token to request
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
```

### 4. Token Generation

Add a utility script for generating secure tokens:

#### 4.1 Create Token Generator Script

Create a new file `scripts/generate-tokens.ts`:

```typescript
// scripts/generate-tokens.ts
import { parseArgs } from "@std/cli/parse-args";

function generateSecureToken(length = 48): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return encodeBase64(buffer).replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
}

const token = generateSecureToken();

console.log(`Generated token for Browse Together MCP:

== API Token ==
${token}

To use this token, set the following environment variable:
export BROWSER_API_TOKEN=${token}

Or create a .env file:
BROWSER_API_TOKEN=${token}
`);
```

### 5. Usage Documentation

#### 5.1 Update README with Token Instructions

Update the project README to include token usage instructions:

#### 5.2 Update .env.example with Token Instructions

Add token instructions to the .env.example file:

```markdown
# Security settings
BROWSER_API_TOKEN=      # Required API token for authentication (generate with scripts/generate-tokens.ts)
```

```markdown
## Security Tokens

For security reasons, both the Browser Service and MCP Server require authentication tokens:

1. Generate secure token:
   ```
   deno run -A scripts/generate-tokens.ts
   ```

2. Use the generated token when launching the services:
   ```
   export BROWSER_API_TOKEN=YOUR_TOKEN

   # Start Browser Service with token
   deno run -A browser.ts
   
   # Start MCP Server with the same token
   deno run -A mcp.ts
   ```

## Implementation Steps

1. **Update Configuration**:
   - Add token config option to `config.ts`
   - Update the config schema to include required token field

2. **Browser Service Authentication**:
   - Add token validation to Deno.serve request handler in `browser.ts`
   - Verify token on all API calls
   - Refuse to start without a configured token

3. **MCP Server Authentication**:
   - Add token to Browser Service API calls in `callBrowserApi`
   - Refuse to start without a configured token

4. **Token Generation**:
   - Create the token generation utility script
   - Document token generation and usage

5. **Testing**:
   - Test browser service with valid and invalid tokens
   - Test MCP server with valid and invalid tokens
   - Test end-to-end functionality with correct authentication

## Addendum: Authentication Strategy

The current implementation focuses on securing the Browser Proxy Service with token-based authentication. This approach is based on the following considerations:

1. **Threat Model**: The Browser Proxy Service exposes an HTTP API that could potentially be accessed by unauthorized clients if not secured.

2. **Security Boundary**: The MCP Server acts as a client to the Browser Proxy Service and must pass the token to authenticate its requests.

3. **Implementation Simplicity**: Using a single token for Browser Proxy Service authentication provides adequate security while keeping the implementation straightforward.

4. **User Experience**: This approach minimizes configuration complexity for developers while maintaining a secure system.

This approach provides a balance between security and simplicity. The MCP Server itself does not require additional token-based authentication as it uses the FastMCP protocol which has its own authentication mechanisms built in when needed.

## Security Considerations

1. **Token Storage**:
   - Do not hardcode tokens in the source code
   - Do not store tokens in version control
   - Use environment variables or a secure credential store

2. **Token Management**:
   - Rotate tokens periodically
   - Use different tokens for different deployment environments
   - Consider implementing token expiration in future iterations

3. **Transport Security**:
   - If used outside of localhost, ensure all HTTP traffic uses TLS/HTTPS
   - Consider adding support for CORS if needed for specific domain access
