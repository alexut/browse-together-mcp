# Initial Design Decisions

**(Note:** The project structure described below reflects the initial phase focused on `cli.ts`. The project has since evolved to include the `browser.ts` proxy service and `types.ts`, making the structure more complex than depicted here. See the main `README.md` for the current overview.)**

## Project Structure

We've chosen a minimal, single-file approach for our TypeScript CLI tool:

```
/
├── deno.json           # Configuration and import maps
├── deno.lock           # Dependency lockfile
├── cli.ts             # Single file containing all logic
├── README.md          # Project documentation
└── docs/              # Documentation directory
```

## Design Decisions

### Single-File Approach

While Deno conventionally uses `mod.ts` as an entry point, we opted against this pattern because:

1. **Direct Purpose**: Our tool is a CLI application, not a library. It doesn't need to expose an API for other modules to import.
2. **Reduced Complexity**: Keeping all logic in `cli.ts` eliminates unnecessary abstraction layers.
3. **Easier Maintenance**: Single file means all related code is co-located, making it easier to understand and modify.
4. **Clear Intent**: The structure immediately communicates that this is a CLI tool.

### Modern Dependency Management

1. **JSR-First Approach**: We use JSR (`jsr:`) imports for standard library modules, following Deno's recommended practices.
2. **Lockfile Integration**: We enforce dependency locking through `deno.lock` to ensure consistent builds.
3. **Import Maps**: Dependencies are centralized in `deno.json` using modern import map syntax.

### Why Not mod.ts?

The `mod.ts` convention is most valuable when:
- Creating a library for others to import
- Needing to separate public API from internal implementation
- Re-exporting functionality from multiple modules

None of these cases apply to our CLI tool, which is meant to be executed rather than imported.

### Implementation Details

1. **Type-Safe Error Handling**: Proper error handling with TypeScript type narrowing for better error messages.
2. **Task-Based Execution**: Using Deno tasks in `deno.json` for standardized execution:
   ```bash
   deno task start <file-or-directory>
   ```
3. **Permission Management**: Minimal permissions model using `--allow-read` for file access.

The tool can be run using the task defined in `deno.json`, which ensures consistent execution with proper permissions and lockfile validation.