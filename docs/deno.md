# Deno Best Practices

This document outlines the best practices for developing a server-side
application, CLI, or package using Deno.

## Dependency Management

### Use CLI Tools for Dependency Management

Deno offers CLI commands for managing dependencies, making it easier to work with `deno.json`.

- To add a dependency:

  ```bash
  deno add npm:lodash
  ```

- To remove a dependency:
  ```bash
  deno remove lodash
  ```

This approach avoids manual editing of `deno.json` and ensures consistent dependency management.

### Use Import Maps

Always use import maps in `deno.json` for dependency management rather than
direct URL imports. This approach:

- Centralizes dependency management in one file
- Makes it easier to update dependencies across the project
- Provides cleaner imports in code files
- Follows modern Deno best practices

### Migrating from deps.ts to Import Maps

If your project uses `deps.ts` for dependency management, consider transitioning to import maps for centralized and scalable dependency handling. Follow these steps:

1. Create a `deno.json` file with an `imports` field:

   ```json
   {
     "imports": {
       "zod": "https://deno.land/x/zod@v3.22.4/mod.ts",
       "std/assert": "https://deno.land/std@0.224.0/assert/mod.ts"
     }
   }
   ```

2. Move all dependencies from `deps.ts` to the `imports` section of `deno.json`.

3. Update imports in your code to use the shorter specifiers:

   ```typescript
   // Old (using deps.ts):
   import { z } from "./deps.ts";

   // New (using import maps):
   import { z } from "zod";
   ```

4. Use the `deno run --lock=deno.lock` command to lock dependencies and ensure future builds maintain integrity.

### Best Practices for Import Maps

When defining imports in `deno.json`, avoid adding trailing slashes (`/`) to module specifiers. For example:

```json
{
  "imports": {
    "lodash": "npm:lodash@^4.17.21" // No trailing slash
  }
}
```

This simplifies imports and ensures compatibility with Deno's internal resolution logic.

Example `deno.json` with import maps supporting multiple protocols:

```json
{
  "imports": {
    "lodash": "npm:lodash@^4.17.21",
    "moment": "jsr:moment@^2.29.1",
    "uuid": "https://deno.land/std@0.224.0/uuid/mod.ts"
  }
}
```

This allows projects to combine packages from npm (`npm:`), JSR (`jsr:`), and third-party HTTPS imports seamlessly.

Example `deno.json` with import maps:

```json
{
  "imports": {
    "zod": "npm:zod@3.24.2",
    "std/assert": "jsr:@std/assert@1.0.12"
  }
}
```

Example usage in code:

```typescript
// Instead of this:
// import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

// Do this:
import { z } from "zod";
```

## Publishing

### JSR Import Requirements

When publishing to JSR, you must use JSR-compatible imports. JSR only supports
importing:

- `npm:` - Node.js packages
- `jsr:` - JSR packages
- `node:` - Node.js built-in modules

REQUIRED: Convert all direct URL imports (https://...) in your import maps to
use one of the supported protocols, especially `npm:` for external packages:

```json
// INCORRECT for JSR publishing:
"imports": {
  "zod": "https://deno.land/x/zod@v3.22.4/mod.ts"
}

// CORRECT for JSR publishing:
"imports": {
  "zod": "npm:zod@3.22.4"
}
```

### Include Required Files

When publishing to JSR or other registries, make sure to include your
`deno.json` and `deno.lock` files in the published package:

```json
"publish": {
  "include": ["*.ts", "README.md", "LICENSE", "deno.json", "deno.lock"]
}
```

## Testing

Use the latest version of Deno's standard library for testing:

```typescript
import { assertEquals, assertThrows } from "std/assert";
import { describe, it } from "std/testing/bdd";
```

- Use Jest-like `describe`, `it`, and lifecycle hooks (`beforeEach`, `afterEach`, etc.) from `std/testing/bdd`.

## Standard Libraries

### Command Line Arguments

Deno provides both built-in functionality and standard library modules for working with command line arguments:

- **Basic access**: Use `Deno.args` to access raw command line arguments as an array
- **Structured parsing**: Use `std/cli` module's `parseArgs` function to convert arguments into structured data. The current version is `@std/cli@1.0.15`.

#### Using parseArgs

The `parseArgs` function converts command line flags like `--foo=bar` into structured objects:

```typescript
import { parseArgs } from "jsr:@std/cli/parse-args";

const flags = parseArgs(Deno.args, {
  boolean: ["help", "color"],     // Define boolean flags
  string: ["version"],            // Define string flags
  default: { color: true },         // Set default values
  negatable: ["color"],           // Allow --no-prefix (e.g., --no-color)
});

console.log("Help flag:", flags.help);
console.log("Version:", flags.version);
console.log("Color enabled:", flags.color);
console.log("Non-flag arguments:", flags._);  // Arguments not parsed as flags
```

**Note**: This implementation is based on `minimist` and is not compatible with Node.js `util.parseArgs()`.

#### Additional Resources

- [Deno.args API documentation](https://deno.land/api?unstable=&s=Deno.args)
- [@std/cli module documentation](https://jsr.io/@std/cli)

## Type Safety

### Match Dependency Versions Exactly

**CRITICAL**: Use identical version specifiers across all packages to prevent
TypeScript and instanceof errors:

```json
// WRONG: Different version specifiers
Project:    "zod": "npm:zod@^3.22.4"
Subpackage: "zod": "npm:zod@3.22.4"

// CORRECT: Identical version specifiers
Project:    "zod": "npm:zod@3.22.4"
Subpackage: "zod": "npm:zod@3.22.4"
```

Inconsistent versions cause type errors with generic libraries (esp. Zod,
Effect, etc):

- Type mismatches in parameters/properties
- "Excessively deep and possibly infinite" type instantiations
- Incompatible internal type structures

### Lockfile Integrity

Use a lockfile (`deno.lock`) to ensure consistent builds and prevent unintended dependency upgrades. To lock dependencies:

1. Generate a `deno.lock` file after installing dependencies:

   ```bash
   deno cache --lock=deno.lock
   ```

2. Enforce frozen lockfile mode during execution:
   ```bash
   deno run --lock=deno.lock
   ```

By using the `--lock` flag, you prevent changes to the dependency graph unless explicitly allowed, ensuring stable and repeatable builds.
