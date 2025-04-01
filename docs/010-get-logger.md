# Logging Implementation Plan

## Architecture

### Centralized Logging Module

```
logging.ts
├── setupLogging() - One-time global configuration
└── getLogger() - Factory for module-specific loggers
```

- **Single Configuration Point**: LogTape configured once at application startup
- **Hierarchical Categories**: All loggers namespaced under `tele-ts` root
- **Environment-Aware**: Different formats and levels for dev/test/prod

### Integration with Existing Config

- Leverages `LOG_LEVEL` from `config.ts` (already configured with Zod validation)
- Environment detection via `APP_ENV` determines formatter and default levels
- Development: Colored console output with detailed logs
- Production: JSON structured logs for machine parsing
- Testing: Minimal output (errors only)

## Deno-Specific Best Practices

### Dependency Management

Add LogTape via the Deno CLI with specific version:

```bash
# Add LogTape with exact version
deno add jsr:@logtape/logtape@1.0.0
```

### Import Maps Configuration

Ensure `deno.json` has proper import map configuration with exact version:

```json
{
  "imports": {
    "@logtape/logtape": "jsr:@logtape/logtape@1.0.0"
  }
}
```

### Version Consistency

**IMPORTANT**: Use identical version specifiers across the project to prevent TypeScript compatibility issues. Always use the lockfile to ensure dependency stability:

```bash
# Run with lockfile to ensure consistent dependencies
deno run --lock=deno.lock main.ts
```

## Implementation Details

### Core Module (`logging.ts`)

```typescript
import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  getLogger as getLogtapeLogger,
  type Logger,
} from "@logtape/logtape";
import config from "./config.ts";

const APP_CATEGORY = "tele-ts";

// Call once during application startup
export async function setupLogging() {
  const isDevelopment = config.APP_ENV === "development";
  const isTest = config.APP_ENV === "test";
  
  try {
    await configure({
      sinks: {
        console: getConsoleSink({ 
          formatter: isDevelopment 
            ? ansiColorFormatter 
            : (record) => JSON.stringify(record) + "\n"
        }),
      },
      loggers: [
        { 
          category: [APP_CATEGORY], 
          sinks: ["console"], 
          // Use error-only logging in test environment
          lowestLevel: isTest ? "error" : config.LOG_LEVEL 
        }
      ],
    });
  } catch (error) {
    // Fallback to console logging if LogTape setup fails
    console.error("Failed to initialize logging system:", error);
  }
}

// Factory function for consistent module-specific loggers
export function getLogger(module: string): Logger {
  return getLogtapeLogger([APP_CATEGORY, module]);
}
```

### Entry Point Integration (`browser.ts`)

- Add logging initialization to the application entry point:

```typescript
import { setupLogging, getLogger } from "./logging.ts";
import config from "./config.ts";

// Initialize logging early
await setupLogging();
const logger = getLogger("browser");

// Replace console.log with structured logging
logger.info("Browser proxy service starting", { appEnv: config.APP_ENV });
```

### Usage Patterns

**Simple Messages**:
```typescript
logger.info("Starting browser context");
```

**Structured Context**:
```typescript
logger.error("Error closing page", { 
  pageId, 
  error: error.message, 
  stack: error.stack 
});
```

**Request Tracing**:
```typescript
const requestId = crypto.randomUUID().slice(0, 8);
logger.debug("Request received", { requestId, method, path });
// ... handler logic ...
logger.debug("Response sent", { requestId, status });
```

## Benefits

1. **Consistent Interface**: Standard pattern for logging across all modules
2. **Environment Optimization**: 
   - Development: Human-readable colored output
   - Production: Machine-parseable JSON logs
   - Testing: Minimal output (errors only)
3. **Structured Data**: Context objects rather than string interpolation
4. **Severity Control**: Appropriate use of debug/info/warn/error levels
5. **Type Safety**: Full TypeScript integration with LogTape types

## Migration Path

1. Create `logging.ts` module
2. Initialize in `browser.ts` entry point
3. Incrementally replace `console.log` calls with appropriate logger methods
4. Add structured context to error logs for improved debugging

## Shutdown Logging Considerations

1. **Preserve Final Logs**: In shutdown handlers, ensure logs are flushed to output before process termination
2. **Graceful Cleanup**: Log shutdown sequence with appropriate severity levels

```typescript
// In shutdown function
logger.info("Shutting down browser proxy service...");
// ... shutdown operations ...
logger.info("Browser proxy service shutdown complete");

// Ensure logs are flushed before exit
setTimeout(() => Deno.exit(0), 500);
```
