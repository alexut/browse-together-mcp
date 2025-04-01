# Type Safety Plan for Browser Commands

## Current Issues

1. **Unsafe JSON Parsing**: We currently cast request body directly to `BrowserCommand` without validation.
2. **Permissive Type Structure**: The current `BrowserCommand` interface doesn't enforce specific properties for different actions, which can lead to runtime errors when required properties are missing.

## Proposed Solution

1. **Add Zod for Schema Validation**: Implement Zod schemas to validate incoming data and ensure it conforms to our expected command structure.
2. **Implement Discriminated Union Pattern**: Replace the current interface with a discriminated union that enforces specific properties for each command type.

## Implementation Steps

1. **Install Zod Dependency**: Add Zod to our project.
2. **Create Command Schemas**: Define Zod schemas for each command type with appropriate validation.
3. **Implement Base Schema**: Create a common base for all commands with the discriminated union pattern.
4. **Update Request Handling**: Replace the unsafe type casting with proper Zod validation.
5. **Use Inferred Types**: Generate TypeScript types from Zod schemas.

## Example Schema Structure

```typescript
// Base schema with shared properties
const baseCommandSchema = z.object({
  action: z.string(),
  timeout: z.number().optional(),
});

// Command-specific schemas
const gotoCommandSchema = baseCommandSchema.extend({
  action: z.literal("goto"),
  url: z.string().url(),
  params: z.record(z.unknown()).optional(),
});

const clickCommandSchema = baseCommandSchema.extend({
  action: z.literal("click"),
  selector: z.string(),
  params: z.record(z.unknown()).optional(),
});

// ... other command schemas

// Union all command types
const browserCommandSchema = z.discriminatedUnion("action", [
  gotoCommandSchema,
  clickCommandSchema,
  // ... other schemas
]);

// Infer type from schema
type BrowserCommand = z.infer<typeof browserCommandSchema>;
```

## Benefits

1. **Runtime Validation**: Ensures that incoming data conforms to our expected schema before processing.
2. **Improved Type Safety**: Makes impossible states impossible at the type level.
3. **Better Developer Experience**: TypeScript will provide better autocomplete and error checking when working with command objects.
4. **Self-Documentation**: The schema serves as documentation for the API, making it clear what properties are required for each command.

## Migration Strategy

1. Implement the new schemas in parallel with the existing interface.
2. Update the request handling to validate input using Zod.
3. Gradually refactor the executeCommand function to use the new discriminated union type.
4. Update any client code that constructs BrowserCommand objects.

## Code Organization

### Types Separation

We've chosen to move all type definitions and Zod schemas into a dedicated `types.ts` file for several reasons:

1. **Separation of Concerns**: Keeping type definitions separate from implementation logic makes both easier to manage.
2. **Reduced File Size**: The browser.ts file was becoming too large with both implementation and type definitions.
3. **Reusability**: Types can now be imported by other modules that need them without creating circular dependencies.
4. **Maintainability**: Type definitions are easier to find, review, and update when they're not mixed with implementation code.
5. **Documentation**: The types file serves as a form of documentation for the API's data structures.

This approach is particularly beneficial as our type definitions become more sophisticated with Zod schemas and discriminated unions.
