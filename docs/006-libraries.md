# Libraries Used

This project relies on several key external libraries and Deno standard modules.

## Core Dependencies

### Playwright (`npm:playwright`)

*   **Purpose:** The core engine for browser automation. Playwright provides APIs to launch browsers (Chromium, Firefox, WebKit), create isolated contexts, manage pages, and interact with web content (navigation, clicking, typing, evaluating scripts, taking screenshots, etc.).
*   **Why Chosen:** It's a powerful, modern, and well-maintained library for reliable browser automation, supporting multiple browsers and offering features like persistent contexts which are key to this project's single-session design.
*   **Usage:** Used in `browser.ts` to launch `chromium.launchPersistentContext`, create `newPage`, and execute all browser actions (`page.goto`, `page.click`, etc.).

### Zod (`npm:zod`)

*   **Purpose:** Schema declaration and validation library. It allows defining precise data structures (schemas) and validating JavaScript objects against them at runtime.
*   **Why Chosen:** Provides robust runtime validation for the incoming HTTP API commands, ensuring that requests have the correct structure and data types before attempting to execute them with Playwright. Its ability to infer TypeScript types from schemas (`z.infer`) and support for discriminated unions significantly improves type safety and developer experience.
*   **Usage:** Used extensively in `types.ts` to define the `browserCommandSchema` and its constituent parts (e.g., `gotoCommandSchema`, `clickCommandSchema`). The schema is used in `browser.ts` to parse and validate the request body (`browserCommandSchema.safeParse`).

### @folder/xdg (`npm:@folder/xdg`)

*   **Purpose:** Provides access to XDG Base Directory Specification paths (standard locations for configuration, data, cache files) across different operating systems (Linux, macOS, Windows).
*   **Why Chosen:** Used to determine the standard user-specific configuration directory (`~/.config` on macOS/Linux) in a platform-agnostic way. This allows storing the persistent Playwright profile (`playwright/profile`) in a conventional location without hardcoding paths like `~/Library/Application Support` or `~/.config`.
*   **Usage:** Used in `browser.ts` within `setupBrowser` to find the appropriate directory for the persistent Playwright context (`join(dirs.config, "playwright", "profile")`).

## Deno Standard Library (`jsr:@std/...`)

*   **`@std/path`:** Provides utilities for working with file paths (like `join`) in a platform-independent manner. Used in `browser.ts` and `cli.ts`.
*   **`@std/fs`:** Provides file system utilities like `walk` (used in `cli.ts`) and `ensureDir` (implicitly via `Deno.mkdir({ recursive: true })` in `browser.ts`).
*   **`@std/flags`:** Used for parsing command-line arguments (used in `cli.ts`).
*   **`@std/http`:** (Implicit via `Deno.serve`) Deno's native, high-performance HTTP server API used in `browser.ts` to handle incoming API requests.

Understanding these libraries is key to understanding the project's architecture and capabilities.