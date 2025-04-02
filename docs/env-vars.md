# Environment Variable Best Practices

This guide outlines best practices for managing environment variables in
TypeScript applications using the `@canadaduane/ts-env` package.

## Core Principles

1. **Schema as Source of Truth**: Define all environment variables in a single
   schema that serves as documentation and validation.
2. **Fail Fast**: Validate environment variables at startup to catch
   configuration issues immediately.
3. **Type Safety**: Leverage TypeScript types derived from Zod schemas
   throughout the application.
4. **Clear Error Messages**: Provide actionable error messages when validation
   fails.
5. **Default Values**: Use sensible defaults where appropriate (e.g., optional,
   non-secret values) to simplify development.

## Avoid Built-in Environment Variable Capabilities

Do NOT use `process.env` or `Deno.env` directly. They are not type-safe, and do
not provide defaults consistent with the schema.

DO import the `env` object you created with `loadEnv`.

## Implementation with @canadaduane/ts-env

### Installation

```bash
# For Deno
deno add @canadaduane/ts-env
```

### Basic Usage

```typescript
// env.ts
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";

// Define and validate environment variables in one step
export const { env } = loadEnv({
  APP_ENV: presets.appEnv(),
  PORT: presets.port(),
  LOG_LEVEL: presets.logLevel(),
  API_KEY: envVar(z.string().min(10), {
    required: true,
    description: "API authentication key",
  }),
  DATABASE_URL: envVar(z.string().url(), {
    required: true,
    description: "Database connection URL",
  }),
});
```

## Advanced Techniques

### Environment-Specific Validation

```typescript
// First check for APP_ENV to determine validation context
const appEnv = Deno.env.get("APP_ENV") || "development";
const isProduction = appEnv === "production";

const { env } = loadEnv({
  APP_ENV: presets.appEnv(),

  // Only required in production
  DATABASE_URL: envVar(z.string().url(), {
    required: isProduction,
    default: isProduction ? undefined : "sqlite://local.db",
    description: "Database connection URL",
  }),

  // Different validation based on environment
  LOG_LEVEL: envVar(
    isProduction
      ? z.enum(["info", "warn", "error"])
      : z.enum(["debug", "info", "warn", "error"]),
    {
      default: isProduction ? "info" : "debug",
      description: "Logging verbosity level",
    },
  ),
});
```

### Error Handling

```typescript
// With custom error handling
const { env, warnings } = loadEnv(envSchema, {
  exitOnError: false, // Don't exit process on validation error
});

if (warnings.length > 0) {
  console.warn("Environment variable warnings:");
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
```

### Using Presets and Custom Transformations

```typescript
const { env } = loadEnv({
  // Built-in presets for common variables
  APP_ENV: presets.appEnv(),
  PORT: presets.port(),
  LOG_LEVEL: presets.logLevel(),
  FEATURE_FLAG: presets.booleanFlag(),

  // Custom transformations
  ALLOWED_ORIGINS: envVar(
    z.string().transform((str) => str.split(",").map((s) => s.trim())),
    {
      default: ["localhost"],
      description: "Comma-separated list of allowed origins",
    },
  ),

  CONFIG_JSON: envVar(
    z.string().transform((str) => JSON.parse(str)),
    { default: {}, description: "Configuration as JSON string" },
  ),

  TIMEOUT_MS: envVar(
    z.coerce.number().pipe(
      z.number().min(100).max(30000),
    ),
    { default: 5000, description: "Request timeout in milliseconds" },
  ),
});
```

We can also use the `validateEnv` function which is what the `loadEnv` function
uses under the hood.

```typescript
/**
 * Validate environment variables against a schema
 *
 * @param schema - The schema to validate against
 * @param options - Configuration options
 * @returns The validated environment variables
 * @throws Error if validation fails and exitOnError is false
 */
export function validateEnv<T, I>( schema: z.ZodType<T, z.ZodTypeDef, I>, options: LoadEnvOptions = {} ): T
```

## Best Practices

1. **Document Requirements**: Include a `.env.example` file showing all required
   and optional variables.

2. **Centralize Configuration**: Keep all environment variable parsing in a
   single file.

3. **Avoid Direct Access**: Never use `process.env` or `Deno.env` directly
   outside the config file.

4. **Secrets Management**: Don't log sensitive environment variables, even in
   error messages.

5. **Local Development**: Use `.env` files for local development but not in
   production.

## Common Pitfalls

1. **Boolean Confusion**: Environment variables are strings, so
   `process.env.DEBUG === 'false'` is truthy. Use `presets.booleanFlag()` for
   proper parsing.

2. **Missing Validation**: Assuming an environment variable exists can lead to
   runtime errors. Always validate.

3. **Overly Strict Validation**: Be careful not to make development difficult
   with unnecessary restrictions.

4. **Inconsistent Naming**: Follow a consistent naming convention (typically
   UPPER_SNAKE_CASE).

## Testing

When testing code that uses environment variables, prefer dependency injection
over modifying global state.

### Recommended Approach: Dependency Injection

```typescript
// In your application code, accept env as a parameter with a default
function startServer(config: Partial<Env> = env) {
  const port = config.PORT ?? 3000;
  console.log(`Starting server on port ${port}`);
  // ...
}

// In your tests
test("server starts on custom port", () => {
  const testEnv = { PORT: 4000 };
  // Pass the test environment to the function
  startServer(testEnv);
  // Assert expected behavior
});
```

This approach:

- Avoids mutating global state
- Makes dependencies explicit
- Prevents test interdependencies
- Makes tests more predictable and isolated
