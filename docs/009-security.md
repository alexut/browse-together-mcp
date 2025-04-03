# Security Considerations

This project consists of two main components:
1.  A **Browser Proxy Service** (`browser.ts`) that exposes low-level browser control via an HTTP API (defaulting to `localhost:8888`).
2.  An **MCP Server** (`mcp.ts`) that provides a higher-level interface using the Model Context Protocol (MCP) and communicates with the Browser Proxy Service.

Exposing browser control, even indirectly via the MCP server, introduces significant security risks if not handled carefully. Both components, in their current state, are designed primarily for trusted local environments.

## Key Risks

1.  **Unauthorized Access to Browser Service:** Anyone who can reach the Browser Service's HTTP port (`8888` by default, typically `localhost`) can fully control the browser instance. This includes navigation, interaction, potential file downloads, and accessing content from previous sessions due to the persistent profile.
2.  **Unauthorized Access to MCP Server:** Anyone who can connect to the MCP server (which runs via STDIO by default when launched by clients like Claude Desktop) can invoke its tools, indirectly controlling the browser.
3.  **Resource Exhaustion:** Malicious or poorly behaved clients could rapidly invoke tools (like creating pages via the browser service or running intensive operations), potentially crashing the browser or the server due to excessive CPU/memory usage.
4.  **Data Exposure:**
    *   Tools like `content` or `screenshot` (if added) could retrieve sensitive information from web pages.
    *   The persistent profile stores cookies, local storage, and session data. Compromise of the browser service could lead to exfiltration of this data.
    *   The `fetch` tool in `mcp.ts` uses the `evaluate` command in `browser.ts`, allowing arbitrary JavaScript execution within the context of browsed pages. This could be used to steal credentials or session tokens if navigating to sensitive sites.
5.  **Server-Side Request Forgery (SSRF):** Controlling the browser allows navigating to internal network addresses accessible by the machine running the browser service.
6.  **Input Injection:** While Zod validation is used at both the MCP server layer (tool parameters) and the browser service layer (API commands), complex inputs or interactions with website JavaScript could still lead to vulnerabilities, especially via the `evaluate` command used by the `fetch` tool.
7.  **Account Flagging:** While stealth techniques (`020-chromium-stealth.md`) aim to prevent *detection* by websites, aggressive automation (even if appearing human-like) can still lead to account flagging or CAPTCHAs on sensitive sites like Google. Stealth is not a security feature against unauthorized access.

## Current Security Posture

*   **No Authentication/Authorization:** Neither the Browser Service HTTP API nor the MCP Server has built-in mechanisms to verify client identity or permissions. Access is determined solely by network reachability (for the browser service) or process invocation (for the MCP server via STDIO).
*   **Permissions:**
    *   The Browser Service (`browser.ts`) requires broad Deno permissions: `--allow-read`, `--allow-write`, `--allow-net`, `--allow-run`, `--allow-env`, `--allow-sys`.
    *   The MCP Server (`mcp.ts`) requires: `--allow-read`, `--allow-net`, `--allow-env`, `--allow-sys`.
    These permissions increase the potential impact if either service process is compromised.
*   **Persistence:** The use of a persistent profile (by default) means session data (logins, cookies) remains between commands and service restarts, increasing the value of the profile as a target.
*   **Input Validation:** Zod schemas are used to validate the structure and basic types of incoming commands/tool parameters at both the MCP server and browser service layers. However, this does not sanitize the *content* of strings (e.g., JavaScript for `evaluate`).

## Mitigation Strategies (Mostly Not Implemented)

If this system were to be used in less trusted environments, consider implementing:

1.  **Authentication/Authorization:**
    *   Protect the Browser Service HTTP API with a secret token or API key.
    *   Add authentication to the MCP Server (FastMCP supports this, but it's not currently used).
2.  **Authorization:** Implement rules about which clients can perform which actions (e.g., restrict `evaluate` or `fetch`).
3.  **Input Sanitization:** Carefully scrutinize inputs used in `evaluate` or potentially dangerous actions, beyond basic Zod validation. Potentially disallow or heavily restrict the `fetch`/`evaluate` tools.
4.  **Rate Limiting:** Limit the number of requests or new pages a client can create via the MCP server or browser service.
5.  **Network Isolation:** Run the Browser Service on a restricted network interface (e.g., bind only to `127.0.0.1`) and use firewall rules. Ensure the MCP server only connects to the intended browser service instance.
6.  **Resource Monitoring:** Monitor CPU/memory usage and potentially implement limits or automatic restarts.
7.  **Ephemeral Sessions:** Offer an option in `config.ts` to use non-persistent browser contexts (`browserType.launch()` instead of `launchPersistentContext`) for scenarios requiring isolation.
8.  **Least Privilege for Deno:** Regularly review if all granted Deno permissions are strictly necessary for each service.

**Conclusion:** Treat this system, particularly the Browser Service, as providing privileged control over a browser instance. Only run it in environments where you fully trust all clients that can access its API endpoints (Browser Service) or invoke its process (MCP Server). The MCP server adds a layer of abstraction but still relies on the underlying, unsecured browser service.