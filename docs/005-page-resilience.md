# Page Resilience Plan

## Current Issues

1. **Tab Closure Detection**: When users manually close browser tabs, our proxy service is unaware and continues to reference invalid page objects.
2. **Failed Commands**: Attempting to execute commands on closed pages results in errors, disrupting the API workflow.
3. **Inconsistent Page State**: The internal page registry (`pages` object) becomes out of sync with the actual browser state.

## Proposed Solution

1. **Page Validity Checking**: Implement a function to verify if a page is still valid and connected before using it.
2. **Automatic Cleanup**: Add event listeners for 'close' events to automatically remove page references when tabs are closed.
3. **Resilient Page Creation**: Modify the page retrieval logic to create new pages when existing ones are detected as closed.

## Implementation Steps

1. **Create Validation Function**: Implement an `isPageValid` function to check if a page is still connected to the browser.
2. **Add Event Listeners**: Register 'close' event handlers on each page to maintain synchronized state.
3. **Update Page Management**: Modify `getOrCreatePage` to handle potentially closed pages gracefully.
4. **Enhance Error Handling**: Improve error details to distinguish between different types of page failures.

## Implementation Details

```typescript
// Function to check if a page is still valid and connected
async function isPageValid(page: PageType): Promise<boolean> {
  try {
    // Perform a minimal evaluation to check if the page is still connected
    await page.evaluate('1');
    return true;
  } catch (error) {
    return false;
  }
}

// Modified getOrCreatePage with resilience
async function getOrCreatePage(pageId: string) {
  if (!browserContext) {
    throw new Error("Browser context not initialized");
  }

  // Check if the page exists and is still connected
  if (pages[pageId]) {
    if (await isPageValid(pages[pageId])) {
      return pages[pageId];
    }
    
    console.log(`Page ${pageId} was closed externally, cleaning up reference`);
    delete pages[pageId];
    // Continue to create a new page
  }

  // Create a new page
  console.log(`Creating new page: ${pageId}`);
  const page = await browserContext.newPage();
  
  // Add event listener for close events
  page.on('close', () => {
    console.log(`Page ${pageId} closed event detected`);
    delete pages[pageId];
  });
  
  pages[pageId] = page;
  return page;
}
```

## Benefits

1. **Improved Reliability**: The API continues to function even when users interact with the browser directly.
2. **Automatic Recovery**: New pages are created transparently when needed, without requiring client-side error handling.
3. **Real-time Synchronization**: The page registry remains in sync with the actual browser state.
4. **Detailed Diagnostics**: Log messages provide visibility into page lifecycle events for debugging.

## Rationale

This design addresses several key concerns:

1. **Separation of Concerns**: The validity checking is extracted into its own function for better maintainability and reuse.
2. **Defensive Programming**: We assume pages might be invalid at any point and handle this gracefully.
3. **Event-Driven Architecture**: Using Playwright's event system allows us to react to browser changes we don't control.
4. **Progressive Enhancement**: This approach builds on our existing architecture without requiring major restructuring.

The combination of proactive checking (when commands are received) and reactive listening (for close events) provides comprehensive coverage of the page lifecycle, ensuring a robust and resilient browser automation proxy.
