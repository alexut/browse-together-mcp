# Configuration System Refactoring Plan

## Problem Statement

The current configuration system in `config.ts` processes environment variables and CLI arguments at module load time. This approach presents several challenges:

1. **Testing Difficulties**: It's hard to mock environment variables and CLI arguments for tests because they're processed when the module is imported.
2. **Side Effects on Import**: The module has side effects (reading environment, parsing CLI args) that occur whenever it's imported.
3. **Limited Reusability**: Configuration cannot be dynamically regenerated with different inputs.
4. **Integration with Entry Points**: Our main entry point (`browser.ts`) needs more control over when and how configuration is loaded.
5. **Code Duplication**: Several patterns are repeated, particularly around JSON parsing and validation.
6. **Complexity**: The current flat structure makes the configuration harder to understand and maintain as it grows.

## Refactoring Goals

1. **On-Demand Configuration**: Move from an import-time to a function-call approach for configuration processing.
2. **Testability**: Make it easier to inject mocked environment variables and CLI arguments for testing.
3. **Clear Separation of Concerns**: Separate schema definition, environment loading, CLI parsing, and configuration validation.
4. **Type Safety**: Maintain or improve existing type safety.
5. **Backward Compatibility**: Ensure existing code that imports the configuration still works.
6. **Simplified Implementation**: Reduce duplication and improve maintainability through cleaner patterns.
7. **Logical Grouping**: Organize configuration options into logical groups for better readability.

## Implementation Plan

### 1. Simplify Common Patterns

Before restructuring, we'll implement helper functions to eliminate duplication:

```typescript
// Helper for JSON parsing (eliminate duplication)
function jsonTransformer<T>(defaultValue: T) {
  return (str: string): T => {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  };
}
```

### 2. Restructure `config.ts` into Callable Functions

Convert the current structure into a collection of pure functions:

```typescript
// Schema definition with logical grouping (no side effects)
export function defineConfigSchema() {
  const appEnv = Deno.env.get("APP_ENV") || "development";
  const isProduction = appEnv === "production";
  
  return {
    APP_ENV: presets.appEnv(),
    
    // Group related configs for better organization
    server: {
      LOG_LEVEL: envVar(z.enum(["debug", "info", "warn", "error"]), {
        default: isProduction ? "info" : "debug",
        description: "Logging verbosity level",
        validate: (val) => {
          if (isProduction && val === "debug") {
            throw new Error("Debug logging is not allowed in production");
          }
        }
      }),
      PORT: envVar(z.coerce.number().int().positive().max(65535), { 
        default: 8888,
        description: "HTTP port for the proxy service"
      }),
    },
    
    browser: {
      HEADLESS: presets.booleanFlag({
        default: isProduction,
        description: "Whether to run browser in headless mode"
      }),
      PROFILE_DIR: envVar(z.string(), {
        default: path.join(xdg.darwin().config, "playwright", "profile"),
        description: "Absolute path to the browser profile directory"
      }),
      
      // Use the jsonTransformer to eliminate duplicated parsing logic
      IGNORE_DEFAULT_ARGS: envVar(
        z.string().transform(jsonTransformer(["--enable-automation"])),
        {
          default: JSON.stringify(["--enable-automation"]),
          description: "Default browser arguments to ignore as JSON array"
        }
      ),
      BROWSER_ARGS: envVar(
        z.string().transform(jsonTransformer(["--no-default-browser-check"])),
        {
          default: JSON.stringify(["--no-default-browser-check"]),
          description: "Additional browser launch arguments as JSON array"
        }
      ),
      BROWSER_OPTIONS: envVar(
        z.string().transform(jsonTransformer({})),
        {
          default: "{}",
          description: "Additional browser launch options as JSON string"
        }
      ),
    }
  };
}

// Environment variable loading
export function loadEnvironmentConfig(
  schema = defineConfigSchema(),
  environment = Deno.env.toObject()
) {
  return loadEnv(schema, {
    exitOnError: false,
    env: environment, // Allow injection of environment for testing
  });
}

// Auto-generate CLI options from schema
export function defineCliOptions(schema = defineConfigSchema(), envConfig = loadEnvironmentConfig().env) {
  // Automatically build CLI options from schema
  const options: CliOption[] = [];
  
  // Process schema and create CLI options
  function processSchemaSection(section: Record<string, any>, prefix = "") {
    for (const [key, value] of Object.entries(section)) {
      // Skip non-env var entries
      if (!value || typeof value !== 'object' || !('description' in value)) {
        if (typeof value === 'object' && value !== null) {
          // This is a nested section
          processSchemaSection(value, prefix ? `${prefix}-${key}` : key);
        }
        continue;
      }
      
      // Convert ENV_VAR to cli-flag format
      const flag = prefix ? 
        `${prefix}-${key.toLowerCase().replace(/_/g, '-')}` : 
        key.toLowerCase().replace(/_/g, '-');
      
      options.push({
        flag,
        // Generate aliases from first letter if simple name
        aliases: key.length > 3 && !prefix ? [key[0].toLowerCase()] : undefined,
        description: value.description,
        type: typeof value.default === 'boolean' ? 'boolean' : 
              typeof value.default === 'number' ? 'number' : 'string',
        default: envConfig[key],
        envVar: key
      });
    }
  }
  
  processSchemaSection(schema);
  
  return options;
}

// CLI parser configuration
export function buildCliParserOptions(cliOptions = defineCliOptions()) {
  const options = {
    string: [] as string[],
    boolean: [] as string[],
    // ...
  };
  
  // Build options from cliOptions array
  // ...
  
  return options;
}

// CLI argument parsing
export function parseCliArguments(
  args = Deno.args,
  options = buildCliParserOptions()
) {
  return parseArgs(args, options);
}

// Help text generation
export function generateHelpText(cliOptions = defineCliOptions()) {
  // ...
}

// Configuration merging (env + CLI)
export function mergeConfiguration(
  envConfig = loadEnvironmentConfig().env,
  cliArgs = parseCliArguments()
) {
  const config: Record<string, unknown> = { ...envConfig };
  
  // Override with CLI values
  // ...
  
  return config as Config; // Type assertion to Config interface
}

// The main function to get configuration
export function getConfig(
  environment = Deno.env.toObject(),
  args = Deno.args
) {
  const envConfig = loadEnvironmentConfig(defineConfigSchema(), environment).env;
  const cliOptions = defineCliOptions(envConfig);
  const parserOptions = buildCliParserOptions(cliOptions);
  const cliArgs = parseCliArguments(args, parserOptions);
  
  // Handle help flag
  if (cliArgs.help) {
    generateHelpText(cliOptions);
    return null; // Signal that help was displayed
  }
  
  return mergeConfiguration(envConfig, cliArgs);
}

// Browser-specific options helper
export function getBrowserLaunchOptions(config = getConfig()) {
  if (!config) return null; // Handle case where help was displayed
  
  return {
    // ...
  };
}

// Maintain backward compatibility with a default export
// This will maintain the current behavior for existing imports
let defaultConfig: Config | null = null;

export function initializeDefaultConfig() {
  defaultConfig = getConfig();
  return defaultConfig;
}

// For backward compatibility
export default defaultConfig || initializeDefaultConfig();
```

### 2. Update Type Definitions

```typescript
// Define clear interfaces for all configuration types
export interface Config {
  APP_ENV: string;
  LOG_LEVEL: string;
  // ...
}

export interface BrowserLaunchOptions {
  // ...
}
```

### 3. Entry Point Integration

Update `browser.ts` to explicitly initialize configuration:

```typescript
import { getConfig, getBrowserLaunchOptions } from "./config.ts";

// Initialize configuration explicitly
const config = getConfig();
if (!config) {
  // Help was displayed
  Deno.exit(0);
}

const browserOptions = getBrowserLaunchOptions(config);
// ...rest of browser.ts
```

## Benefits of the Simplified Approach

The simplified approach offers several advantages beyond just testability:

1. **Reduced Duplication**: The `jsonTransformer` helper eliminates repeated JSON parsing logic.
2. **Logical Organization**: Grouping related configuration options (server, browser) improves readability.
3. **Automated CLI Generation**: Automatically generating CLI options from the schema reduces manual maintenance.
4. **Consistency**: Standardized handling of environment variables and CLI arguments ensures consistent behavior.
5. **Extensibility**: Adding new configuration options becomes easier with the structured approach.

## Testing Strategy

With this refactored approach, testing becomes much simpler:

```typescript
// Example test
import { assertEquals } from "std/assert";
import { getConfig, loadEnvironmentConfig } from "../config.ts";

Deno.test("config loads environment variables correctly", () => {
  const mockEnv = {
    "APP_ENV": "test",
    "LOG_LEVEL": "debug",
    // ...
  };
  
  const envConfig = loadEnvironmentConfig(undefined, mockEnv).env;
  assertEquals(envConfig.APP_ENV, "test");
  assertEquals(envConfig.LOG_LEVEL, "debug");
});

Deno.test("config overrides environment with CLI args", () => {
  const mockEnv = {
    "LOG_LEVEL": "debug",
  };
  
  const mockArgs = ["--log-level", "warn"];
  
  const config = getConfig(mockEnv, mockArgs);
  assertEquals(config.LOG_LEVEL, "warn");
});

// More tests for edge cases and validations...
```

## Implementation Phases

1. **Phase 1**: Implement helper functions and simplify schema definition
2. **Phase 2**: Create the new functional structure while maintaining the default export
3. **Phase 3**: Update `browser.ts` to use the new explicit configuration initialization
4. **Phase 4**: Write tests using the new structure
5. **Phase 5**: (Optional) Remove the default export once all code has been migrated to the functional approach

## Conclusion

This refactoring moves our configuration system from an import-time to a function-call approach, making it more testable and giving better control over when and how configuration is processed. The simplified implementation reduces duplication, improves organization, and makes the codebase more maintainable. It maintains backward compatibility while providing a clearer path forward for all configuration needs.
