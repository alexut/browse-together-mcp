# Security Considerations

Exposing browser control via an HTTP API introduces significant security risks if not handled carefully. This service, in its current state, is designed for trusted environments.

## Key Risks

1.  **Unauthorized Access:** Anyone who can reach the HTTP port (`8888` by default) can fully control the browser instance associated with the service. This includes navigating to any website, interacting with elements, potentially downloading files (depending on browser configuration), and accessing content from previous sessions due to the persistent profile.
2.  **Resource Exhaustion:** Malicious or poorly behaved clients could rapidly create pages or run intensive operations, potentially crashing the browser or the server due to excessive CPU/memory usage.
3.  **Data Exposure:**
    *   Screenshots or page content retrieved via the API could contain sensitive information.
    *   The persistent profile stores cookies, local storage, and session data. If the service is compromised, this stored data could be accessed or exfiltrated.
    *   Commands involving `evaluate` allow arbitrary JavaScript execution within the context of the browsed pages, which could be used to steal credentials or session tokens if navigating to sensitive sites.
4.  **Server-Side Request Forgery (SSRF):** While less direct, controlling the browser allows navigating to internal network addresses that the machine running the proxy service can access.
5.  **Input Injection:** Although Zod provides validation, complex `evaluate` scripts or unexpected interactions with website JavaScript could still lead to vulnerabilities if not carefully managed.

## Current Security Posture

*   **No Authentication/Authorization:** The API has no built-in mechanism to verify the identity or permissions of the client making requests. Access is determined solely by network reachability.
*   **Permissions:** The service requires broad Deno permissions (`--allow-read`, `--allow-write`, `--allow-net`, `--allow-run`, `--allow-env`, `--allow-sys`) to function, increasing the potential impact if the service process itself is compromised.
*   **Persistence:** The use of a persistent profile means session data (logins, cookies) remains between commands and service restarts, increasing the value of the profile as a target.

## Mitigation Strategies (Not Implemented)

If this service were to be used in less trusted environments, consider implementing:

1.  **Authentication:** Protect API endpoints with a secret token (e.g., Bearer token in Authorization header), API key, or other authentication mechanism.
2.  **Authorization:** Implement rules about which clients can perform which actions or access which pages (if multi-tenancy were ever introduced).
3.  **Input Sanitization:** While Zod validates structure, carefully scrutinize inputs used in `evaluate` or potentially dangerous actions.
4.  **Rate Limiting:** Limit the number of requests or new pages a client can create in a given time window.
5.  **Network Isolation:** Run the service on a restricted network interface or use firewall rules to limit access strictly to trusted clients.
6.  **Resource Monitoring:** Monitor CPU/memory usage and potentially implement limits or automatic restarts.
7.  **Ephemeral Sessions:** Offer an option to use non-persistent browser contexts (`chromium.launch` instead of `launchPersistentContext`) for scenarios requiring isolation and no data persistence.
8.  **Least Privilege for Deno:** Review if all granted Deno permissions are strictly necessary.

**Conclusion:** Treat this service as having root-level control over a browser. Only run it in environments where you fully trust all clients that can access its API endpoint.