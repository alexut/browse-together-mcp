# Logging

This guide covers how to set up and use the LogTape logging library in a
Deno-based server-side application (with vanilla Deno runtime). It will show how
to install and import LogTape using JSR in Deno, recommend best practices for
structuring your logging code, and outline configuration strategies for
different environments (tests, development, staging/production). Finally, it
offers tips to minimize log noise (e.g. frequent heartbeats) and maximize useful
signal (e.g. errors around sync issues).

## Installation and Import (JSR in Deno)

LogTape is distributed on the JavaScript Registry (JSR) and npm. In Deno, it's
recommended to install from JSR​
[ref](https://logtape.org/manual/install#:~:text=NOTE). Use the Deno CLI to add
the module to your project:

```bash
deno add jsr:@logtape/logtape
```

This fetches `@logtape/logtape` from JSR and updates your Deno project
configuration (e.g. `deno.json`). After adding, you can import LogTape in your
code just like a standard module:

```ts
import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  getLogger,
} from "@logtape/logtape";
```

Here, `configure` will be used to set up global logging settings, and
`getLogger` creates logger instances. (The `getConsoleSink` and
`ansiColorFormatter` are utilities for sending logs to console with optional
formatting, which we'll use later.)

**Note:** You should call `configure()` **once** in your application's entry
point to initialize logging. After that, use `getLogger()` in each module to
obtain a logger for that module. Avoid calling `configure()` in every file or
inside libraries (let the application do it).
[ref](https://logtape.org/manual/start#:~:text=Set%20up%20LogTape%20in%20the,of%20your%20application%20using%20configure)

## Best Practices for Using LogTape

When integrating LogTape into your Deno server, keep these best practices in
mind for clean, maintainable logging:

- **Logger per Module (Categorized Logging):** Create a separate logger for each
  module or service. This helps namespace your logs and control verbosity per
  module. For example, in a file `userService.ts` you might do:
  `const logger = getLogger(["my-app", "user-service"]);`. Using a hierarchical
  category (like `["my-app", "user-service"]`) tags all logs from that module
  with that category. This makes filtering easier and allows different log
  levels per category if needed. (LogTape uses hierarchical categories so that
  e.g. `["my-app"]` is a parent of `["my-app","user-service"]`, letting you
  configure global vs module-specific logging.)
  [ref](https://logtape.org/manual/categories#:~:text=LogTape%20uses%20a%20hierarchical%20category,module%22%5D%60%20is%20a%20category)
- **Structured Log Messages:** Prefer structured logging over just plain
  strings. LogTape lets you pass an object with contextual data as the second
  argument to any log call. For example:
  `logger.info("User connected", { userId, roomId });`. This produces a log
  record with structured fields (here `userId` and `roomId`) in addition to the
  message, making it easier to search and analyze logs later​. Structured logs
  are very useful for debugging state synchronization issues – you can include
  identifiers like document IDs, version numbers, etc., in the log record
  instead of formatting them into a string.
  [ref_1](https://logtape.org/manual/struct#:~:text=LogTape%20provides%20built,metadata%20with%20your%20log%20messages)
  [ref_2](https://logtape.org/manual/struct#:~:text=info)
- **Appropriate Severity Levels:** Use log levels judiciously to mark the
  importance of events. For example, use `debug` for low-level details and
  routine events (e.g. a heartbeat ping or a CRDT update message), `info` for
  important but normal events (a user connected, a document sync completed),
  `warning` for odd or unexpected situations that aren’t errors but might need
  attention (e.g. a temporary desync that self-resolved), and `error` for actual
  errors or failures (like an unhandled exception or a sync operation that
  failed). Reserving **error** only for genuine errors and using **debug** for
  chatter will help filter noise later​. In practice, this means _don’t_ call
  `logger.error` for every minor issue—use `info` or `warn` appropriately—so
  that when you filter logs by level, the signal (actual problems) stands out.
  [ref_1](https://logtape.org/manual/library#:~:text=3,detailed%20information%20useful%20during%20development)
  [ref_2](https://logtape.org/manual/library#:~:text=3,detailed%20information%20useful%20during%20development)
- **Consistent Message Structure:** Keep log messages consistent and easy to
  grep. For example, start messages with an action verb or event name
  (“Connected to room...”, “Failed to apply update...”). When using template
  literal logging (LogTape supports template strings as well), keep the format
  uniform. Consistency will pay off when scanning development logs or querying
  production logs.
- **Avoid Excessive Logging in Hot Paths:** Be mindful not to log inside very
  tight loops or extremely high-frequency events at too high a level. For
  instance, if your CRDT sync library triggers an event for every keystroke or
  heartbeat, avoid logging each one at `info` level. Either log them at `debug`
  or not at all, to prevent flooding your logs. Save logging for state changes
  or outcomes rather than every tick of the system.

By following these practices (one logger per module, structured messages with
context, proper severity usage, etc.), you can maintain clarity and relevance in
your log output.

## Environment-Specific Logging Configuration

Different environments require different logging configurations. You can use
`configure()` to adjust sinks, formats, and log levels based on the runtime
environment. Below are recommended strategies for Tests, Development, and
Staging/Production.

### Testing Environment (Quiet or Errors-Only)

In test runs, you usually want to suppress non-critical logs to keep test output
readable (or completely silent unless something goes wrong). The simplest
approach is to set the minimum log level high (e.g. only errors and above). For
example, configure LogTape in your test setup to log only errors:

```ts
import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(), // default text formatter (no colors)
  },
  loggers: [{ category: ["my-app"], sinks: ["console"], lowestLevel: "error" }],
});
```

In this configuration, `lowestLevel: "error"` ensures that `debug`, `info`, and
`warning` messages are ignored, and only `error` (and `fatal`) will actually be
output. This keeps routine log noise out of test results. If even error logs are
not needed in tests (for example, you want absolutely no logging unless a test
fails), you can set the level to `"fatal"` or configure a no-op sink. However,
keeping errors on can be helpful to surface unexpected issues during tests.

_Tip:_ You might conditionally set this configuration only when running tests
(e.g. check `Deno.env.get("ENV") === "test"` or use a flag in your test runner
to initialize logging differently).

### Development Environment (Verbose & Human-Readable)

During development, you typically want more verbose logging and in a format
that's easy to read. You can enable console logging with colored, nicely
formatted output and a lower severity threshold so you see debug information.
LogTape provides an ANSI color formatter for console logs​.
[ref](https://logtape.org/manual/formatters#:~:text=This%20API%20is%20available%20since,0)

For example:

```ts
import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
} from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink({ formatter: ansiColorFormatter }),
  },
  loggers: [{ category: ["my-app"], sinks: ["console"], lowestLevel: "debug" }],
});
```

Here we use `ansiColorFormatter` to add color to the console output for
different log levels (e.g. info vs error)​, which improves readability in the
terminal. We also set `lowestLevel: "debug"` for the `"my-app"` category so that
**all** messages (debug and above) are shown. This is useful while developing,
as you can see detailed flow information, but you might adjust it to "info" if
debug logs become too noisy.
[ref](https://logtape.org/manual/formatters#:~:text=This%20API%20is%20available%20since,0)

In development mode, it’s also useful to include stack traces or additional
context for errors. If an error occurs, log it with the Error object or stack
info: for example `logger.error("Unhandled exception", { error })`. LogTape’s
structured logging will include the error’s message and stack in the log record
(which you’ll see in the console). This helps you debug issues faster.

### Staging/Production Environment (Structured JSON, High Signal)

For staging and production, prioritize structured, parseable logs and limit
verbosity. A common practice is to output logs as JSON lines, which can be
ingested by log aggregators (like Loki, CloudWatch, etc.) easily. You should
also raise the minimum log level to reduce chatter, focusing on important
events.

For example, you can configure LogTape to use a JSON formatter and only log info
and above:

```ts
import { configure, getConsoleSink } from "@logtape/logtape";

// Define a simple JSON-lines formatter for log records
const jsonLinesFormatter = (record: unknown) => JSON.stringify(record) + "\n";

await configure({
  sinks: {
    console: getConsoleSink({ formatter: jsonLinesFormatter }),
  },
  loggers: [{ category: ["my-app"], sinks: ["console"], lowestLevel: "info" }],
});
```

In this setup, every log record will be `JSON.stringify`-ed into a single line
of output​. ([ref](https://logtape.org/manual/formatters#:~:text=typescript)) The
log record includes the timestamp, severity, category, message, and any
structured properties you attached (e.g. `userId`, `docId`, etc.). This
structured output is ideal for production: it's machine-readable and can be
indexed by logging systems. We choose `"info"` as the lowest level, meaning
debug details will be skipped in production. You might even elevate to
`"warning"` in a high-traffic system to further cut down volume, depending on
what “normal” info logs entail in your app. The goal is to log only what’s
valuable for monitoring and debugging production issues.

Also, to avoid overly verbose logs, you generally wouldn't include full stack
traces in every log in production. Instead, rely on the logged message and
context, or use an error tracking service. If an error is critical, you might
integrate LogTape with an external sink (for example, LogTape has integrations
like a Sentry sink) to send the error details elsewhere, rather than printing
huge traces in your log files. In staging, you can use the same JSON setup as
production (to mimic production conditions), but perhaps set the threshold to
"debug" or "info" if developers need more insight while testing in that
environment.

## Minimizing Log Noise and Maximizing Signal

Finally, tune your logging to reduce noise and highlight important information
in each context:

- **Use Log Levels to Filter Noise:** The log level threshold (`lowestLevel`) is
  your first line of defense against log noise. In production, keep it at a
  higher level (info or warning) so that routine debug messages (like each CRDT
  operation or heartbeat) don’t even get recorded. In development, you can lower
  it to debug to see everything. This way, the volume of logs is appropriate to
  the environment.
- **Filter Out Routine Events:** Identify high-frequency, low-value events (e.g.
  WebSocket heartbeat pings, periodic health checks, or every tiny CRDT delta
  sync message) and avoid logging each occurrence in production. If you still
  want to log them for debugging, log them at `debug` level, or use LogTape’s
  filter mechanism to drop them in certain environments. LogTape allows custom
  filter functions that decide whether to log a record. For example, you could
  create a filter that returns `false` for a log record where
  `message == "ping"` or a property `eventType == "heartbeat"`, effectively
  silencing those in production. By filtering out these routine messages, you
  ensure your logs aren't drowning in noise.
  [ref](https://logtape.org/manual/filters#:~:text=A%20filter%20is%20a%20function,The%20signature%20of%20Filter%20is)
- **Log on Significant Events or Errors:** Conversely, make sure to log the
  important events and anomalies. For instance, when a collaborative document
  sync _fails_ or falls out-of-sync and has to be corrected, that’s worth a log
  at warning or error level. Similarly, if a client reconnects after a drop or a
  merge conflict is resolved, consider logging a concise info or warning message
  about it. This way, in production logs you will primarily see indicators of
  issues or noteworthy state changes, rather than a flood of every sync packet.
  Aim for logs that help you answer questions like "when/why did synchronization
  break down?" rather than logging every successful sync (which is expected
  behavior).
- **Avoid Duplicative Logging:** If your WebSocket framework or CRDT library
  already logs certain events (or if you have metrics elsewhere), you can skip
  logging them again in your code. For example, if Loro.dev internally tracks
  and logs heartbeat signals or state changes, double-logging them in your app
  is unnecessary. Focus on logging what the underlying libraries _don’t_ log,
  such as higher-level application events or handling of error conditions.
- **Continuous Refinement:** Treat logging as an evolving aspect of your
  project. During development and staging, pay attention to which log lines are
  actually useful and which are noisy. Adjust log levels or add filters
  accordingly. The result should be that in development you have all the data
  you need, and in production you have mostly the "signal" – a clear narrative
  of the system’s behavior and any problems, without the clutter.

By following these guidelines, your use of `@logtape/logtape` will be idiomatic
and efficient: you install it easily via JSR, instrument your Deno code with
structured, leveled logs, and configure it to be quiet when it should be
(tests/production) and verbose when it needs to be (debugging sessions). This
ensures that whether you're debugging a tricky CRDT sync issue or monitoring a
live system, the logging output is working _for_ you and not against you.

Addendum:

Let the log level be dynamic:

```ts
const level = Deno.env.get("LOGLEVEL") ?? "error";
await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["my-app"], sinks: ["console"], lowestLevel: level }],
});
```

```sh
LOGLEVEL=debug deno test
```

## Project Implementation Pattern

For our project, we've standardized the logging implementation approach to maintain consistency and avoid circular dependencies. The complete design is documented in `docs/implementation/logger.md`, with key aspects summarized below:

### Central Logging Module

We organize all logging functionality in a single module (`src/logging.ts`) that exports two main functions:

1. **`initializeLogging()`**: Initializes LogTape with the appropriate configuration.
2. **`getLogger()`**: Creates category-namespaced loggers for use throughout the codebase.

### Avoiding Circular Dependencies

A rare issue is circular dependencies between the logging module and other dependencies. The only case we know of where this occurs is the environment configuration (`src/env.ts`), which we potentially need in order to configure the logger. To resolve this:

```typescript
// In src/logging.ts
import { presets } from "@canadaduane/ts-env";

export async function initializeLogging() {
  // Read LOG_LEVEL directly from Deno.env instead of importing from src/env.ts
  const rawLogLevel = Deno.env.get("LOG_LEVEL");

  // Use the same validation schema as in env.ts
  const parseResult = presets.logLevel().schema.safeParse(rawLogLevel);

  let logLevel = "info"; // Default
  if (parseResult.success) {
    logLevel = parseResult.data.toLowerCase();
  }

  // Configure LogTape...
}
```

This approach provides the same validation as in `src/env.ts` while preventing circular imports.

### Standardized Logger Creation

We use a consistent pattern for getting loggers throughout the application:

```typescript
// In src/logging.ts
export function getLogger(category: string | string[]): Logger {
  // Ensure all loggers are under the "ts-parallel" namespace
  const fullCategory = ["ts-parallel"].concat(
    Array.isArray(category) ? category : [category]
  );
  return baseGetLogger(fullCategory);
}

// Usage in modules:
import { getLogger } from "../logging.ts";
const logger = getLogger("feature-name");
// Or for more specific categorization:
const logger = getLogger(["feature", "sub-component"]);
```

This approach ensures:

- Every module gets a properly namespaced logger
- All logs share a common root category (`ts-parallel`)
- Category hierarchies support fine-grained filtering

### Initialization at Application Startup

```typescript
// In the application entry point
import { initializeLogging } from "./logging.ts";

// Must be called early in the startup process
await initializeLogging();
```

For full implementation details and examples, see `docs/implementation/logger.md`.
