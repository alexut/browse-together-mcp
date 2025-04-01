# Configuration

This document outlines how the browser proxy service is configured and proposes a robust, type-safe approach to configuration management.

## Current Configuration (Hardcoded)

As of the current implementation, key parameters are hardcoded within `browser.ts`:

1.  **HTTP Port:** The service listens on port `8888`.
    *   _Location:_ `browser.ts` near the `Deno.serve` call.
2.  **Playwright Profile Path:** The persistent browser profile is stored relative to the user's standard configuration directory, specifically within a `playwright/profile` subdirectory.
    *   _Location:_ `browser.ts` within the `setupBrowser` function, using `@folder/xdg` to find the base config directory.
    *   _Example (macOS):_ `~/Library/Application Support/playwright/profile`
    *   _Example (Linux):_ `~/.config/playwright/profile`
3.  **Playwright Launch Options:** Options like `headless: false`, `viewport: null`, and specific arguments (`--enable-automation`, `--no-default-browser-check`) are hardcoded.
    *   _Location:_ `browser.ts` within the `setupBrowser` function call to `chromium.launchPersistentContext`.

## Recommended Implementation: Type-Safe Environment Variables

Following our environment variable best practices, we should implement configuration using the `@canadaduane/ts-env` package to ensure type safety, validation, and clear documentation.

### Core Principles

1. **Schema as Source of Truth**: Define all configuration options in a single schema that serves as both documentation and validation.
2. **Fail Fast**: Validate configuration at startup to catch issues immediately.
3. **Type Safety**: Use TypeScript types derived from Zod schemas throughout the application.
4. **Clear Error Messages**: Provide actionable error messages when validation fails.
5. **Default Values**: Use sensible defaults where appropriate to simplify development.

### Implementation Example

Create a new file `config.ts` to centralize all configuration:

```typescript
// config.ts
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";
import * as path from "std/path";
import { getUserConfigDir } from "@folder/xdg";

// Determine environment
const appEnv = Deno.env.get("APP_ENV") || "development";
const isProduction = appEnv === "production";

// Define configuration schema with validation and defaults
export const { env, warnings } = loadEnv({
  // Basic configuration
  APP_ENV: presets.appEnv(),
  LOG_LEVEL: envVar(
    isProduction
      ? z.enum(["info", "warn", "error"])
      : z.enum(["debug", "info", "warn", "error"]),
    {
      default: isProduction ? "info" : "debug",
      description: "Logging verbosity level",
    }
  ),
  
  // Server configuration
  PORT: envVar(z.coerce.number().int().positive().max(65535), { 
    default: 8888,
    description: "HTTP port for the proxy service"
  }),
  
  // Playwright configuration
  HEADLESS: presets.booleanFlag({
    default: isProduction,
    description: "Whether to run browser in headless mode"
  }),
  
  PROFILE_DIR: envVar(z.string(), {
    default: path.join(getUserConfigDir(), "playwright", "profile"),
    description: "Absolute path to the browser profile directory"
  }),
  
  // Advanced browser options (as JSON string for flexibility)
  BROWSER_OPTIONS: envVar(
    z.string().transform((str) => {
      try {
        return str ? JSON.parse(str) : {};
      } catch (e) {
        throw new Error(`Invalid JSON in BROWSER_OPTIONS: ${e.message}`);
      }
    }),
    {
      default: "{}",
      description: "Additional browser launch options as JSON string"
    }
  ),
}, {
  exitOnError: true, // Fail fast on invalid configuration
});

// Log any warnings but continue execution
if (warnings.length > 0) {
  console.warn("Configuration warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

// Export typed configuration object
export type Config = typeof env;

// Export a single default configuration object for import throughout the application
export default env;
```

### Usage in Application

In `browser.ts` and other files, import the centralized configuration:

```typescript
// browser.ts
import config from "./config.ts";

// Use typed configuration values
console.log(`Starting proxy server on port ${config.PORT}`);
Deno.serve({ port: config.PORT }, handler);

// In setupBrowser function
async function setupBrowser() {
  const userDataDir = config.PROFILE_DIR;
  
  // Merge default options with any custom options from environment
  const browserOptions = {
    headless: config.HEADLESS,
    viewport: null,
    args: [
      "--enable-automation",
      "--no-default-browser-check",
    ],
    ...config.BROWSER_OPTIONS, // Apply any custom overrides
  };
  
  // Rest of the function...
}
```

## Local Development

For local development, create a `.env` file in the project root:

```
# .env
PORT=9000
HEADLESS=false
LOG_LEVEL=debug
```

And a `.env.example` file to document the available options:

```
# .env.example - Configuration reference
# Server
PORT=8888                # HTTP port for the service

# Browser settings
HEADLESS=false           # Run browser in headless mode
PROFILE_DIR=             # Custom profile directory (defaults to system config dir)
BROWSER_OPTIONS='{"args":["--some-flag"]}' # Additional browser options as JSON

# Application behavior
APP_ENV=development      # development, testing, production
LOG_LEVEL=debug          # debug, info, warn, error
```

## Command-Line Flags

As an alternative or complement to environment variables, command-line arguments will be parsed using the recommended `@std/cli` library (version `@std/cli@1.0.15`) and merged into the environment configuration:

First, define the import in your `deno.json` import maps:

```json
// deno.json
{
  "imports": {
    "std/cli": "jsr:@std/cli@1.0.15"
  }
}
```

Then use the import map reference in your code:

```typescript
// In main.ts or entry point
import { parseArgs } from "std/cli/parse-args";
import config from "./config.ts";

// Parse command line flags
const flags = parseArgs(Deno.args, {
  string: ["profile-dir", "log-level"],  // String arguments
  boolean: ["headless"],                // Boolean flags
  number: ["port"],                     // Numeric arguments
  default: {                            // Default values
    "log-level": "info"
  },
  negatable: ["headless"]               // Allow --no-headless format
});

// Create a merged configuration with command-line flags taking precedence
const runtimeConfig = {
  ...config,
  PORT: flags.port ?? config.PORT,
  HEADLESS: flags.headless ?? config.HEADLESS,
  PROFILE_DIR: flags["profile-dir"] ?? config.PROFILE_DIR,
  LOG_LEVEL: flags["log-level"] ?? config.LOG_LEVEL
};

// Start the application with the merged configuration
startProxy(runtimeConfig);
```

### Example Usage

```bash
# Start with custom port and headless mode
deno run -A main.ts --port=9090 --headless

# Start with GUI browser and custom profile
deno run -A main.ts --no-headless --profile-dir=./browser-data --log-level=debug
```

## Benefits of This Approach

1. **Single Source of Truth**: All configuration is defined and validated in one place.
2. **Type Safety**: TypeScript intellisense provides autocompletion and type checking.
3. **Validation**: Configuration errors are caught at startup, not at runtime.
4. **Documentation**: The schema itself documents the available options and their constraints.
5. **Flexibility**: Easy to add new configuration options with minimal changes.
6. **Testing**: Makes it easy to provide test-specific configuration through dependency injection.

Implementing this configuration approach will make the service more robust and adaptable to different deployment scenarios without requiring code changes.