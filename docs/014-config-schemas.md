# Refactoring Plan for `config.ts`

## Objectives
1. **Use Strict Type Safety**: Avoid using `Record<>` types for looping over objects. Instead, define explicit types for configuration objects to ensure type safety.
2. **Separate Environment Variable Schema from CLI Schema**: Create distinct schemas for environment variables and CLI arguments to enhance clarity and maintainability.
3. **Maintain Configuration Precedence**: Ensure that the priority order of configuration remains CLI arguments > environment variables > defaults.

## Refined Approach

After careful consideration, we have refined our approach to be more parsimonious and type-safe:

1. **Single Source of Truth**: Use `envSchema` as the single source of truth for configuration structure and validation.
2. **CLI Argument Mapping**: Define an array-based mapping between CLI arguments and environment variables.
3. **Direct Transformation**: Transform CLI arguments directly into environment variable format for seamless merging.

## Implementation Plan

### 1. Define Environment Schema with Zod

```typescript
// Define the environment schema as the single source of truth
const envSchema = z.object({
  APP_ENV: presets.appEnv(),
  LOG_LEVEL: envVar(z.enum(["debug", "info", "warn", "error"]), {
    default: "debug",
    description: "Logging verbosity level",
  }),
  PORT: envVar(z.coerce.number().int().positive().max(65535), {
    default: 8888,
    description: "HTTP port for the proxy service",
  }),
  // ... other environment variables
});

// Type inference from schema
type EnvConfig = z.infer<typeof envSchema>;
```

### 2. Define CLI to Environment Mapping

```typescript
// Define the mapping as an array of triples: [envKey, cliKey, shortAlias]
const configMapping: [keyof EnvConfig, string, string | undefined][] = [
  ["APP_ENV", "app-env", "e"],
  ["LOG_LEVEL", "log-level", "l"],
  ["PORT", "port", "p"],
  ["HEADLESS", "headless", "h"],
  ["PROFILE_DIR", "profile-dir", "d"],
  ["IGNORE_DEFAULT_ARGS", "ignore-default-args", "i"],
  ["BROWSER_ARGS", "browser-args", "b"],
];

// Extract aliases for CLI argument parsing
const cliAliases = Object.fromEntries(
  configMapping
    .filter(([_, __, shortAlias]) => shortAlias !== undefined)
    .map(([_, cliKey, shortAlias]) => [cliKey, shortAlias])
);
```

### 3. Implement Configuration Loading Functions

```typescript
// Load environment configuration
function loadEnvironmentConfig(): EnvConfig {
  return loadEnv(envSchema).env;
}

// Parse CLI arguments and transform to envSchema format
function parseCliArguments(args: string[] = Deno.args): Partial<EnvConfig> {
  const rawArgs = parseArgs(args, { alias: cliAliases });
  const transformedArgs: Partial<EnvConfig> = {};
  
  configMapping.forEach(([envKey, cliKey, _]) => {
    if (rawArgs[cliKey] !== undefined) {
      transformedArgs[envKey] = rawArgs[cliKey] as any;
    }
  });
  
  return transformedArgs;
}
```

### 4. Implement Merging with Correct Precedence

```typescript
// Merge configurations with CLI taking precedence
function mergeConfiguration(
  envConfig: EnvConfig,
  cliArgs: Partial<EnvConfig>
): EnvConfig {
  return { ...envConfig, ...cliArgs };
}

// Get the final configuration
function getConfig(): EnvConfig {
  const envConfig = loadEnvironmentConfig();
  const cliArgs = parseCliArguments();
  return mergeConfiguration(envConfig, cliArgs);
}
```

## Key Implementation Insight: When to Apply Schema Validation

During development, we discovered an important insight about configuration processing:

**Schema validation should be applied AFTER merging raw configuration values, not before.**

Initially, we tried validating environment variables first, then merging with CLI arguments. This approach created type inconsistencies because:

1. Environment variables were validated and type-converted (e.g., strings to numbers)
2. CLI arguments remained as strings
3. When merged, we had mixed types for the same properties

The better approach is to:
1. Extract raw environment variables as strings
2. Parse CLI arguments (which are already strings)
3. Merge these raw string values
4. Apply schema validation once to the merged result, handling all type conversions consistently

This ensures that all configuration values, regardless of source, undergo the same validation and type conversion process.

## Benefits of This Approach

1. **Type Safety**: We maintain compile-time type safety through the `EnvConfig` type derived from `envSchema`.
2. **Clarity and Separation**: The environment schema and CLI mapping are clearly separated but related through the mapping array.
3. **Precedence**: The priority order is maintained through the merging process, with CLI arguments taking precedence over environment variables.
4. **Parsimony**: By using a single source of truth (the environment schema), we reduce redundancy and complexity.
5. **Testability**: The functions are designed for easy testing, with clear input/output contracts.
6. **Consistent Type Conversion**: All configuration values undergo the same validation and type conversion process, regardless of their source.

This refined approach ensures that our configuration system is robust, type-safe, and maintainable while adhering to our objectives.
