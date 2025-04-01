# Testing Best Practices

## Use Deno testing framework

Best Practices:

- Use Jest-like `describe`, `it`, and lifecycle hooks (`beforeEach`, `afterEach`, etc.) from `@std/testing/bdd`.
- Use assertions from `@std/assert` and include the third optional `msg` parameter to describe what is being asserted.
- Control permissions per test with `{ permissions: { read: true, ... } }`.
- Filter tests with `--filter` flag, regex patterns (`--filter "/test-*\\d/"`).
- Use `Deno.test.ignore()` for conditional skipping, `Deno.test.only()` for focused testing.
- Run tests in parallel with `--parallel` flag for speed.
- Configure test selection in `deno.json` with `"test": { "include": [...], "exclude": [...] }`.
- Use `--fail-fast` to stop on first failure.
- Choose reporters with `--reporter=[pretty|dot|junit]`.
- Generate coverage reports with `--coverage` flag.
- Utilize `@std/testing/mock` for spies, mocks, and stubs.

## Mocking Complex Dependencies

When testing units that rely on injected dependencies with complex interfaces (like loggers, database clients, etc.), creating accurate mocks can be challenging.

- **Challenge**: Mocks must satisfy the dependency's type signature, which might include numerous methods or properties not directly used by the unit under test.
- **Solution**: Create dedicated helper functions to generate these complex mocks. This encapsulates the mock setup logic and makes tests cleaner.
- **Example**: For testing code that uses an injected `Logger` (from `logtape`), we created a `createMockLogger` helper in `src/sync/registry.test.ts`. This helper returns a `Logger` object where methods are replaced with spies (`@std/testing/mock.spy`) and necessary properties (`category`, `parent`) are given dummy values to satisfy the type checker.

```typescript
// Example structure from src/sync/registry.test.ts
import { spy, type Spy } from "@std/testing/mock";
import type { Logger } from "../logging.ts"; // Assuming Logger type

const createMockLogger = (): {
  logger: Logger;
  spies: { warn: Spy /* ... other spies ... */ };
} => {
  const spies = {
    warn: spy(),
    info: spy(),
    // ... other spies for debug, error, fatal, getChild, with
  };
  let mockLogger: Logger;
  mockLogger = {
    category: ["mock"],
    parent: null, // Satisfy Logger interface
    warn: spies.warn,
    info: spies.info,
    // ... other methods assigned spies ...
    getChild: spy((_subcategory: any): Logger => mockLogger) as any, // Use spy, cast if needed
    with: spy((_context: Record<string, unknown>): Logger => mockLogger),
  };
  return { logger: mockLogger, spies };
};

// Usage in tests:
const { logger: mockLogger, spies } = createMockLogger();
const myServiceFn = createMyService({ logger: mockLogger });
// ... test logic ...
assert(spies.warn.calls.length > 0, "Expected a warning to be logged");
```

## General Testing Guidelines

- Run tests with `deno task test`.
- Name test files as follows:
  - Unit tests: `[file].test.ts`
  - Integration tests: `[file].int.test.ts`
  - End-to-end tests: `[file].e2e.test.ts`
- Helper functions reduce boilerplate (e.g., `createPopulatedState` in registry tests).
- Test deterministic behavior first.
- Explicit error messages in assertions (`assertEquals(a, b, "Reason why a should equal b")`) help debugging.
- Clean up resources after tests (e.g., close files, remove temporary data).
- Underscore-prefix unused type imports (`import type { _UnusedType } from "./mod.ts";`).
- Document test purpose clearly using `describe` and `it` messages.
- Use fresh instances of stateful objects (like CRDTs) for each test to ensure isolation.
- Unit tests verify pure functions and individual components in isolation.
- Integration tests verify interactions between components.
- Keep tests independent to prevent cascading failures.
- Prioritize unit tests for speed and focused feedback.
