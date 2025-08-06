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

## Download Support

The browser proxy service supports downloading files from any page or frame with robust retry logic and multiple trigger methods.

### Download Action

The `download` action combines element triggering and file downloading into a single operation:

```json
{
  "action": "download",
  "selector": "#download-button",
  "frame": "paymentFrame",
  "downloadPath": "./reports",
  "fileName": "statement.pdf",
  "maxAttempts": 3,
  "method": "locator",
  "waitTimeout": 30000
}
```

### Download Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `selector` | string | ✅ | - | CSS selector for download trigger element |
| `frame` | string | ❌ | - | Target frame (same syntax as other actions) |
| `downloadPath` | string | ❌ | `./downloads` | Directory to save downloaded files (ignored if `returnContent: true`) |
| `fileName` | string | ❌ | original name | Custom filename for downloaded file |
| `maxAttempts` | number | ❌ | `3` | Maximum retry attempts (1-10) |
| `method` | enum | ❌ | `locator` | Trigger method: `locator`, `mouse`, `javascript`, `all` |
| `coordinates` | object | ❌ | - | `{x, y}` coordinates for `mouse` method |
| `waitTimeout` | number | ❌ | `30000` | Download timeout in milliseconds |
| `returnContent` | boolean | ❌ | `false` | Return file content in response instead of saving to disk |
| `encoding` | enum | ❌ | `base64` | Content encoding: `base64` or `buffer` (only used with `returnContent`) |

### Trigger Methods

#### Locator Method (Default)
Standard Playwright locator-based clicking:
```json
{
  "action": "download",
  "selector": "#download-btn",
  "method": "locator"
}
```

#### Mouse Method
Click at specific coordinates (useful for complex UI elements):
```json
{
  "action": "download",
  "selector": "#download-btn",
  "method": "mouse",
  "coordinates": {"x": 860, "y": 450}
}
```

#### JavaScript Method
Direct JavaScript click execution:
```json
{
  "action": "download",
  "selector": "#download-btn",
  "method": "javascript"
}
```

#### All Methods
Try multiple approaches with automatic fallback:
```json
{
  "action": "download",
  "selector": "#download-btn",
  "method": "all",
  "coordinates": {"x": 860, "y": 450}
}
```

### Banking PDF Downloads

Example for downloading bank statements from frames:
```json
{
  "action": "download",
  "frame": "main",
  "selector": "#export-pdf",
  "downloadPath": "./bank-statements",
  "fileName": "statement-2025-01.pdf",
  "method": "all",
  "coordinates": {"x": 860, "y": 450},
  "maxAttempts": 5,
  "waitTimeout": 45000
}
```

### Response Format

#### File Save Response (returnContent: false)
```json
{
  "success": true,
  "result": {
    "filePath": "./reports/statement.pdf",
    "originalName": "export.pdf",
    "fileName": "statement.pdf",
    "fileSize": 1024000,
    "attempts": 1
  }
}
```

#### Content Return Response (returnContent: true)
```json
{
  "success": true,
  "result": {
    "content": "JVBERi0xLjQKJfbk/N8KMSAwIG9ia...",
    "originalName": "export.pdf",
    "fileName": "statement.pdf", 
    "fileSize": 1024000,
    "encoding": "base64",
    "attempts": 1
  }
}
```

### Error Handling

Download failures include attempt information:
```json
{
  "success": false,
  "error": "Download failed after 3 attempts. Last error: Timeout waiting for download"
}
```

### Best Practices

1. **Use appropriate methods**: Start with `locator`, fall back to `all` for difficult elements
2. **Set reasonable timeouts**: Banking sites may have slow PDF generation
3. **Organize downloads**: Use `downloadPath` to separate different file types
4. **Handle retries**: Set `maxAttempts` based on site reliability
5. **Custom filenames**: Use `fileName` for consistent file naming
6. **Frame awareness**: Downloads from frames work seamlessly with frame targeting

### Common Patterns

#### Retry with Multiple Methods
```json
{
  "method": "all",
  "maxAttempts": 5,
  "coordinates": {"x": 860, "y": 450}
}
```

#### Organized File Storage
```json
{
  "downloadPath": "./downloads/statements/2025",
  "fileName": "account-123-jan-2025.pdf"
}
```

#### Frame-Based Downloads
```json
{
  "frame": "reportFrame",
  "selector": ".export-button[data-format='pdf']"
}
```

#### Content Return for Wrapper Processing
```json
{
  "selector": "#download-report",
  "returnContent": true,
  "encoding": "base64",
  "maxAttempts": 3
}
```

#### Large File Handling
```json
{
  "selector": "#download-large-file",
  "returnContent": false,
  "downloadPath": "./temp-downloads",
  "fileName": "large-report.pdf"
}
```

### Content Return Limitations

- **Size Limit**: Files larger than 50MB cannot use `returnContent: true`
- **Memory Usage**: Content is held in memory until response is sent
- **Encoding Overhead**: Base64 encoding increases size by ~33%
- **Recommendation**: Use `returnContent: true` for smaller files (<10MB), save larger files to disk

### Wrapper Integration Examples

#### Processing Downloaded Content
```javascript
// Wrapper code example
const response = await browserAction({
  action: "download",
  selector: "#export-btn", 
  returnContent: true,
  encoding: "base64"
});

if (response.success) {
  const pdfBuffer = Buffer.from(response.result.content, 'base64');
  // Process PDF buffer as needed
  await fs.writeFile('./processed/' + response.result.fileName, pdfBuffer);
}
```

#### Fallback Strategy
```javascript
// Try content return first, fallback to file save for large files
try {
  const response = await browserAction({
    action: "download",
    selector: "#export-btn",
    returnContent: true
  });
  // Handle content directly
} catch (error) {
  if (error.message.includes("File too large")) {
    // Fallback to file save
    const response = await browserAction({
      action: "download", 
      selector: "#export-btn",
      downloadPath: "./temp"
    });
    // Read file from disk
  }
}
```