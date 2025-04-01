# Testing Strategy

Currently, this project lacks automated tests. Implementing a robust testing strategy is crucial for ensuring reliability and maintainability, especially for an API service controlling browser actions.

Here's a proposed testing strategy:

## 1. Unit Tests

*   **Focus:** Test individual functions and components in isolation.
*   **Scope:**
    *   **Type/Schema Validation (`types.ts`):** Test the Zod schemas (`browserCommandSchema`) with various valid and invalid inputs to ensure validation logic is correct. Use `safeParse` and assert on the success/error outcomes and specific issues.
    *   **Request Parsing (`browser.ts`):** Test the API request handling logic, specifically how it parses JSON and uses the Zod schema. Mock `req.json()` and test different request bodies.
    *   **Helper Functions:** Test utility functions like `isPageValid` (potentially mocking Playwright page objects).
*   **Tools:** Deno's built-in test runner (`deno test`), `jsr:@std/assert` for assertions, and potentially mocking libraries if needed for complex isolation.

## 2. Integration Tests

*   **Focus:** Test the interaction between different parts of the service, including the HTTP server and basic Playwright interactions, without necessarily needing a live external website.
*   **Scope:**
    *   **API Endpoint Handling:** Start the server (`Deno.serve`) temporarily during the test setup. Send HTTP requests (using `fetch`) to the API endpoints (`/api/browser/:pageId`, `/api/browser/pages`) and verify the responses (status codes, JSON structure, success/error flags).
    *   **Basic Page Lifecycle:** Test creating a page via the API, listing pages, and potentially closing a page. Mock the actual Playwright `browserContext.newPage()` and `page.close()` calls to avoid launching a real browser but verify the internal state (`pages` object) is updated correctly.
*   **Tools:** Deno's test runner, `jsr:@std/assert`, `fetch` API.

## 3. End-to-End (E2E) Tests

*   **Focus:** Test the entire system flow, from receiving an API request to controlling a real browser instance and interacting with a simple, controlled web page.
*   **Scope:**
    *   **Full Command Execution:** Start the proxy service. Send API commands (`goto`, `click`, `fill`, `content`, `screenshot`) targeting a simple local HTML file served during the test or a reliable static test site. Verify that the browser performs the actions and the API returns the expected results (e.g., correct content, successful status, screenshot data).
    *   **Page Resilience:** Test the scenario where a page is closed manually (if possible to simulate reliably) or via the `closePage` command, and ensure subsequent requests to that `pageId` either fail gracefully or create a new page as expected by `getOrCreatePage`.
    *   **Concurrency (Optional but Recommended):** Send multiple concurrent requests targeting the same page ID and verify predictable behavior (requires implementing locking/queuing first).
*   **Tools:** Deno's test runner (potentially running tests serially if they share browser state), `fetch` API, a simple local HTTP server (e.g., using `std/http/file_server`) to serve test HTML pages, potentially Playwright itself within the test suite to inspect browser state if needed. Requires `--allow-net`, `--allow-run`, etc., permissions for the test command.

## Test File Structure

Place test files alongside the code they test, using the `_test.ts` suffix (e.g., `types_test.ts`, `browser_test.ts`).

## Running Tests

Add a task to `deno.json`:

```json
"tasks": {
  // ... other tasks
  "test": "deno test --allow-read --allow-net --allow-run --allow-env --allow-sys"
}
```

Execute using `deno task test`. Permissions need to be adjusted based on the type of tests being run.

Implementing these layers of testing will significantly increase confidence in the proxy service's correctness and stability.