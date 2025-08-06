# Frame Support Documentation

The browser proxy service supports targeting specific frames within web pages for all browser actions. This enables interaction with embedded content such as iframes, login forms, payment widgets, and other frame-based elements.

## Overview

Frame support allows you to:
- Click elements inside specific frames
- Fill form inputs within frames
- Extract content from frame contexts
- Execute JavaScript within frame scopes
- Handle nested frame hierarchies

All browser actions (`click`, `fill`, `content`, `evaluate`) support the optional `frame` parameter to target specific frames.

## Frame Targeting Methods

### 1. Named Frames
Target frames by their `name` attribute:
```json
{
  "action": "click",
  "frame": "mainFrame",
  "selector": "#submit-button"
}
```

### 2. Frame by ID
Target frames using their `id` attribute with CSS selector syntax:
```json
{
  "action": "fill",
  "frame": "#login-frame",
  "selector": "#username",
  "text": "user@example.com"
}
```

### 3. Frame by CSS Selector
Target frames using any CSS selector:
```json
{
  "action": "click",
  "frame": "iframe.payment-widget",
  "selector": "#pay-now-button"
}
```

### 4. Nested Frames
Target deeply nested frames using the `>>` separator:
```json
{
  "action": "fill",
  "frame": "outerFrame >> innerFrame",
  "selector": "#nested-input",
  "text": "nested content"
}
```

## Supported Actions

### Click Actions
```json
{
  "action": "click",
  "frame": "paymentFrame",
  "selector": "#submit-payment"
}
```

### Fill Actions
```json
{
  "action": "fill",
  "frame": "#checkout-iframe",
  "selector": "#card-number",
  "text": "4111111111111111"
}
```

### Content Extraction
Extract HTML content from a specific frame:
```json
{
  "action": "content",
  "frame": "contentFrame"
}
```

### JavaScript Evaluation
Execute JavaScript within a frame context:
```json
{
  "action": "evaluate",
  "frame": "dataFrame",
  "params": {
    "expression": "document.querySelector('#total').textContent"
  }
}
```

## Error Handling

### Frame Not Found
When a specified frame doesn't exist, the API returns an error with available frame information:
```json
{
  "success": false,
  "error": "Frame \"invalidFrame\" not found. Available frames: mainFrame, loginFrame, paymentFrame"
}
```

### Timeout Errors
Frame operations respect the same timeout settings as regular page operations. If an element within a frame cannot be found or interacted with within the timeout period, a timeout error will be returned.

### Malformed Selectors
Nested frame selectors must use the `>>` separator. Malformed selectors (e.g., `frame1 >> >> frame2`) will result in an error.

## Best Practices

### 1. Wait for Frame Loading
Frames may load asynchronously. Ensure frames are fully loaded before attempting to interact with their content:
```json
{
  "action": "evaluate",
  "frame": "asyncFrame",
  "params": {
    "expression": "document.readyState === 'complete'"
  }
}
```

### 2. Use Specific Selectors
When targeting frames, use specific selectors to avoid ambiguity:
```json
// Good - specific selector
{
  "frame": "iframe#payment-form"
}

// Less reliable - generic selector
{
  "frame": "iframe"
}
```

### 3. Handle Cross-Origin Restrictions
Some frames may have cross-origin restrictions that prevent certain operations. The browser will return appropriate error messages in such cases.

### 4. Frame Context Awareness
Remember that JavaScript execution and content extraction occur within the frame's context, not the parent page's context.

## Backward Compatibility

Frame support is fully backward compatible. All existing browser actions continue to work on the main page when no `frame` parameter is specified:
```json
{
  "action": "click",
  "selector": "#main-page-button"
}
```

## Common Use Cases

### Login Forms in Iframes
Many sites embed login forms in iframes for security:
```json
{
  "action": "fill",
  "frame": "#login-iframe",
  "selector": "#username",
  "text": "user@example.com"
}
```

### Payment Widgets
Payment processors often use iframes to handle sensitive card data:
```json
{
  "action": "fill",
  "frame": "iframe[src*='payment-processor.com']",
  "selector": "#card-number",
  "text": "4111111111111111"
}
```

### Embedded Content
Extract content from embedded widgets or documents:
```json
{
  "action": "content",
  "frame": "#embedded-document"
}
```

### Nested Applications
Handle complex nested frame structures:
```json
{
  "action": "click",
  "frame": "appFrame >> toolbarFrame >> menuFrame",
  "selector": "#save-button"
}
```

## Troubleshooting

### Debug Frame Structure
To understand the frame structure of a page, extract content from the main page to see frame elements:
```json
{
  "action": "content"
}
```

### Identify Available Frames
When frame operations fail, error messages include lists of available frames to help with debugging.

### Verify Frame Loading
Use JavaScript evaluation to check if frames are ready:
```json
{
  "action": "evaluate",
  "params": {
    "expression": "Array.from(document.querySelectorAll('iframe')).map(f => f.name || f.id)"
  }
}
```