# Single-Session Browser Proxy

## Overview

We're refactoring the browser proxy service to use a single persistent browser session with named tabs, rather than multiple independent sessions. This document outlines the architectural changes, benefits, implementation details, and potential challenges.

## Architecture Changes

### Current (Multi-Session)
- Multiple browser contexts stored in `sessions` map
- Two-level identification: `/api/browser/:sessionId/:pageId`
- Session isolation with independent cookies/storage
- On-demand browser context creation

### New (Single-Session)
- One global browser context initialized at startup
- Single-level identification: `/api/browser/:pageId`
- Shared cookies/localStorage across all tabs
- Browser launched immediately when server starts

## Rationale

1. **Authentication Persistence**: User logs in once, authentication state is maintained across all tabs
2. **Simplified State Management**: No need to track multiple browser instances
3. **Resource Efficiency**: Single browser instance consumes fewer system resources
4. **Streamlined API**: Removal of session layer reduces API complexity
5. **Consistent User State**: Shared cookies, localStorage, and browser state across all operations

## Implementation Details

### State Management
```typescript
// Replace this:
const sessions: Record<string, { browser: BrowserContextType, pages: Record<string, PageType> }> = {};

// With this:
let browserContext: BrowserContextType;
const pages: Record<string, PageType> = {};
```

### Initialization
```typescript
// Initialize at startup rather than on-demand
await setupBrowser();

async function setupBrowser() {
  const dirs = xdg.darwin();
  const configDir = join(dirs.config, "playwright", "profile");
  await Deno.mkdir(configDir, { recursive: true });
  
  browserContext = await chromium.launchPersistentContext(configDir, {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--no-default-browser-check']
  });
  
  return browserContext;
}
```

### API Changes

#### Endpoints
- Current: `POST /api/browser/:sessionId/:pageId`
- New: `POST /api/browser/:pageId`

#### Page Management
```typescript
async function getOrCreatePage(pageId: string) {
  // No need to check for browser context - already initialized
  
  if (pages[pageId]) {
    return pages[pageId];
  }
  
  const page = await browserContext.newPage();
  pages[pageId] = page;
  return page;
}
```

#### List Pages API
- Current: `GET /api/browser/sessions`
- New: `GET /api/browser/pages`

## Technical Challenges

1. **Browser Lifecycle**
   - Potential issue: Browser crash requires server restart
   - Mitigation: Add browser health checks and auto-restart capability

2. **Concurrency Management**
   - Potential issue: Race conditions when multiple requests target same tab
   - Mitigation: Simple locking mechanism or request queuing per tab

3. **Resource Limitations**
   - Potential issue: Too many tabs exhaust memory
   - Mitigation: Tab lifecycle management (auto-close inactive tabs)

4. **Error Handling**
   - Potential issue: Error in one tab operation affects entire browser
   - Mitigation: Improved error isolation and recovery mechanisms

5. **Tab Cleanup**
   - Potential issue: Unused tabs accumulate
   - Mitigation: Explicit tab closing API and timeout-based cleanup

## Use Cases

This single-session approach is ideal for:
- Authentication-dependent workflows
- Multi-step operations that need persistent state
- Workflows that mimic typical human browsing patterns
- Testing that requires state to be maintained across steps

## Non-Ideal Scenarios

Not well-suited for:
- Operations requiring complete isolation (use containers instead)
- Testing that needs clean/separate sessions
- High-concurrency scenarios with conflicting requirements

## Implementation Timeline

1. Refactor state management to single browser instance
2. Update API endpoints to remove session parameter
3. Add tab management enhancements
4. Implement error handling and recovery mechanisms
5. Update documentation with revised API
