# Firefox Support Implementation Plan

## Overview

This document outlines the plan for adding Firefox browser support to our browser proxy service. Currently, the service only supports Chromium, but Playwright provides robust support for Firefox that we can leverage.

## Implementation Steps

1. **Configuration Updates**

   - Add `BROWSER_TYPE` environment variable to support 'chromium' (default) or 'firefox'
   - Update `.env.example` to document the new option
   - Add browser type to configuration schema in `config.ts`

2. **Browser Service Modifications**

   - Update browser initialization to use the configured browser type
   - Import Firefox from Playwright alongside Chromium
   - Modify browser launch options to be browser-type aware
   - Handle Firefox-specific configuration options

3. **Type System Updates**

   - Add browser type to configuration types
   - Update browser context type to handle Firefox-specific features
   - Ensure type safety across browser implementations

4. **Documentation Updates**
   - Update README.md with Firefox support information
   - Document browser-specific configuration options
   - Add Firefox-specific troubleshooting guidance

## Detailed Changes

### Configuration Schema Update

```typescript
// In config.ts
const envSchema = z.object({
  // ... existing config ...
  BROWSER_TYPE: envVar(z.enum(["chromium", "firefox"]), {
    default: "chromium",
    description: "Browser type to use (chromium or firefox)",
  }),
});
```

### Browser Service Update

```typescript
// In browser.ts
import { chromium, firefox } from "playwright";

// ... existing imports ...

async function setupBrowser() {
  if (browserContext) {
    return browserContext;
  }

  const browserOptions = getBrowserLaunchOptions(config);
  await Deno.mkdir(browserOptions.profileDir, { recursive: true });

  logger.info("Starting browser context", { type: config.BROWSER_TYPE });

  const browserType = config.BROWSER_TYPE === "firefox" ? firefox : chromium;

  browserContext = await browserType.launchPersistentContext(
    browserOptions.profileDir,
    {
      headless: browserOptions.headless,
      viewport: null,
      ignoreDefaultArgs: browserOptions.ignoreDefaultArgs,
      args: browserOptions.args,
    }
  );

  // ... rest of setup ...
}
```

### Environment Example Update

```bash
# .env.example additions
BROWSER_TYPE=chromium    # Browser type to use (chromium or firefox)
```

## Testing Considerations

1. **Browser Installation**

   ```bash
   # Install Firefox browser
   npx playwright install firefox
   ```

2. **Verification Tests**
   - Test basic navigation in Firefox
   - Verify persistent profiles work correctly
   - Check browser-specific features and limitations
   - Ensure graceful fallback for unsupported features

## Usage Example

```bash
# Start with Firefox
deno task proxy --browser-type firefox

# Or use environment variable
BROWSER_TYPE=firefox deno task proxy
```

## Limitations and Considerations

1. **Feature Parity**

   - Some Chromium-specific features may not be available in Firefox
   - CDP (Chrome DevTools Protocol) is not available in Firefox
   - Performance characteristics may differ

2. **Profile Management**

   - Firefox profiles are structured differently from Chromium
   - May need browser-specific profile directory handling

3. **Resource Usage**
   - Firefox may have different memory and CPU requirements
   - Consider documenting resource recommendations

## Future Improvements

1. **WebKit Support**

   - Framework now supports multiple browsers
   - Adding WebKit would follow similar pattern
   - Consider abstracting browser-specific code further

2. **Browser-Specific Options**

   - Add support for browser-specific launch options
   - Allow fine-tuning performance parameters
   - Support custom Firefox preferences

3. **Automatic Installation**
   - Consider adding browser installation checks
   - Provide helpful error messages if browser missing
   - Document installation requirements clearly

## Implementation Order

1. Add configuration support for browser type
2. Update browser initialization code
3. Test Firefox functionality
4. Update documentation
5. Add browser-specific error handling
6. Release and announce Firefox support

This implementation maintains our existing architecture while adding Firefox support in a clean, maintainable way. The changes are backward-compatible and provide a foundation for adding support for other browsers in the future.

## Addendum: Multiple Windows Behavior in Firefox

During testing, it was discovered that Firefox creates multiple browser windows instead of tabs when using `context.newPage()`. This is actually an intentional design decision by the Playwright team, implemented in v1.3, for several important reasons:

### Design Rationale

1. **Context Isolation**

   - Pages from different contexts should not share the same window
   - This ensures better isolation and prevents potential interference between contexts

2. **Screencasting Support**

   - Separate windows make it easier to screencast all pages in headful mode
   - This is particularly important for debugging and visual testing scenarios

3. **Resource Management**
   - Firefox may delete rendered pages from inactive tabs
   - Separate windows help maintain consistent page state

### Impact on Testing

1. **Functional Considerations**

   - While visually different, pages still operate within the same context
   - Most test scenarios should work identically regardless of window/tab presentation
   - API interactions remain consistent between Firefox and Chromium

2. **Resource Usage**
   - Multiple windows may consume more system resources compared to tabs
   - Memory and CPU usage might be higher in Firefox
   - Consider this when planning resource allocation for test environments

### Workaround for Tab-Based Behavior

If your use case specifically requires tab-based behavior (e.g., testing extensions that interact with tabs), there is a workaround using `window.open()`:

```typescript
// TypeScript/JavaScript
async function createNewTab(context) {
  const page = context.pages[0]; // Get the first page
  const [newPage] = await Promise.all([
    context.waitForEvent("page"),
    page.evaluate("() => window.open('about:blank')"),
  ]);
  return newPage;
}

// Usage
const newPage = await createNewTab(context);
await newPage.goto("https://example.com");
```

### Implementation Recommendations

1. **Default Behavior**

   - Accept the multiple-window behavior as the standard for Firefox
   - Design tests to be window/tab agnostic where possible
   - Use the window.open() workaround only when tab-specific behavior is required

2. **Resource Optimization**

   - Close unused pages promptly to manage resource usage
   - Consider implementing page pooling for intensive scenarios
   - Monitor system resource usage when running large test suites

3. **Documentation**
   - Clearly document this behavior in test suites
   - Include the workaround where relevant
   - Note any browser-specific assumptions in the test code

This implementation detail is unlikely to change in future Playwright versions, so it's recommended to design your automation with these considerations in mind rather than trying to force Firefox to behave exactly like Chromium.
