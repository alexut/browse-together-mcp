# Configuration Consolidation Plan

## Current Situation

We currently have configuration handling split across two files:

1. **config.ts**:
   - Uses `@canadaduane/ts-env` with Zod for robust validation
   - Defines configuration schema with smart defaults
   - Loads from environment variables via `loadEnv`
   - Provides type safety via `Config` type export
   - Includes specialized utility functions

2. **cli.ts**:
   - Uses `std/cli/parse-args` for command-line argument processing
   - Imports config.ts defaults but duplicates schema information
   - Manually merges CLI arguments with defaults
   - Lacks the robust validation present in config.ts

This separation creates duplication and potential inconsistencies between environment variable and command-line configurations.

## Goals

1. Define configuration schema in a single location
2. Apply consistent validation across all configuration sources
3. Create a clear precedence order: CLI args > Environment variables > Defaults
4. Improve developer experience with better help text and error messages

## Implementation Plan

### 1. Enhanced Configuration Schema

Extend the existing schema in `config.ts` to include CLI-specific metadata while maintaining the use of `@canadaduane/ts-env` and Zod validation:

```typescript
// Example of enhanced schema with CLI metadata
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";

// Define the schema with CLI metadata
const configSchema = {
  LOG_LEVEL: envVar(
    z.enum(["debug", "info", "warn", "error"])
      .superRefine((val, ctx) => {
        if (isProduction && val === "debug") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Debug logging is not allowed in production",
          });
        }
      }),
    {
      default: isProduction ? "info" : "debug",
      description: "Logging verbosity level",
      cli: {
        flag: "log-level", // Long form CLI flag
        aliases: ["l"],    // Short form alias
        description: "Set logging verbosity (debug, info, warn, error)"
      }
    }
  ),
  // Other configuration options...
};
```

### 2. Unified Configuration Loader

Create a configuration system that integrates both environment variables and CLI arguments:

```typescript
// config.ts
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";
import { parseArgs } from "std/cli/parse-args";

// Step 1: Define schema with CLI metadata
const configSchema = { /* ... as defined above ... */ };

// Step 2: Extract CLI-specific configuration from schema
function getCliOptions(schema: any) {
  const cliOptions = {
    string: [] as string[],
    boolean: [] as string[],
    default: {} as Record<string, any>,
    negatable: [] as string[]
  };

  // Convert schema to parseArgs format
  for (const [key, definition] of Object.entries(schema)) {
    if (!definition.cli) continue;
    
    const flag = definition.cli.flag || key.toLowerCase();
    
    // Determine type based on Zod schema
    if (definition._def?.schema?._def?.typeName === "ZodBoolean") {
      cliOptions.boolean.push(flag);
      cliOptions.negatable.push(flag);
    } else {
      cliOptions.string.push(flag);
    }
    
    // Set default values
    if (definition.default !== undefined) {
      cliOptions.default[flag] = definition.default;
    }
  }
  
  return cliOptions;
}

// Step 3: Parse CLI args with the extracted configuration
function parseCliArgs() {
  const cliOptions = getCliOptions(configSchema);
  return parseArgs(Deno.args, cliOptions);
}

// Step 4: Load environment variables (using existing @canadaduane/ts-env pattern)
const { env: envConfig, warnings } = loadEnv(configSchema, {
  exitOnError: false // Handle errors manually for better messages
});

// Step 5: Parse CLI arguments
const cliArgs = parseCliArgs();

// Step 6: Merge configurations with precedence: CLI > Env > Defaults  
export const config = {
  ...envConfig,
  // Override with CLI values when present
  PORT: cliArgs.port ? Number(cliArgs.port) : envConfig.PORT,
  LOG_LEVEL: cliArgs["log-level"] ?? envConfig.LOG_LEVEL,
  HEADLESS: cliArgs.headless ?? envConfig.HEADLESS,
  // Add other overrides...
};

// Step 7: Export typed configuration
export type Config = typeof config;
export default config;
```

### 3. Help Text Generation

Generate CLI help text directly from the schema documentation:

```typescript
// Help text generator
export function generateHelpText() {
  console.log("Usage: deno run --allow-net --allow-read --allow-env browser.ts [options]");
  console.log("");
  console.log("Options:");
  
  // Extract options and documentation from schema
  for (const [key, definition] of Object.entries(configSchema)) {
    if (!definition.cli) continue;
    
    const flag = definition.cli.flag || key.toLowerCase();
    const aliases = definition.cli.aliases?.length 
      ? `, -${definition.cli.aliases.join(', -')}` 
      : '';
    const defaultValue = definition.default !== undefined 
      ? ` (default: ${JSON.stringify(definition.default)})` 
      : '';
    
    console.log(`  --${flag}${aliases}	${definition.description}${defaultValue}`);
  }
  
  console.log("");
  console.log("Environment variables can also be used for configuration.");
  console.log("For more details, see docs/env-vars.md");
}

// Call with --help flag
if (cliArgs.help) {
  generateHelpText();
  Deno.exit(0);
}
```

### 4. Integration with Existing Logging System

Ensure that the logging system continues to work with our consolidated configuration:

```typescript
// logging.ts updates (minimal changes required)
import config from "./config.ts";

// The existing code already uses the config properly:
const isDevelopment = config.APP_ENV === "development";
const isTest = config.APP_ENV === "test";

// mapLogLevel and other functions remain unchanged
```

### 5. Migration Steps

1. Enhance `config.ts` to include CLI metadata in the schema
2. Extract CLI options and integrate parseArgs from std/cli
3. Remove redundant `cli.ts` or convert it to simply re-export from config.ts
4. Add help text generation based on schema
5. Verify that logging.ts and other dependents continue to work

### 6. Benefits

- Single source of truth for configuration
- Consistent validation across environment variables and CLI arguments
- Maintainability through schema-driven configuration
- Improved developer experience with better help text
- Full type safety throughout the application
- Alignment with Deno best practices from docs/deno.md
- Adherence to environment variable patterns from docs/env-vars.md

## Timeline

1. Schema enhancement - Day 1
2. CLI integration - Day 1  
3. Help text generation - Day 2
4. Integration testing - Day 2
5. Documentation updates - Day 3

