# Playwright Browser Management

## Installation & Updates

### Basic Installation
```bash
# Install default browsers
npx playwright install

# Install specific browser
npx playwright install webkit

# Install system dependencies
npx playwright install-deps

# Combined installation
npx playwright install --with-deps chromium
```

### Updates
```bash
# Update Playwright
npm install -D @playwright/test@latest

# Install new browser versions
npx playwright install

# Check version
npx playwright --version
```

## Browser Configuration

### Supported Browsers
- Chromium (default)
- Firefox
- WebKit
- Branded browsers (Chrome, Edge)
- Mobile emulation

### Project Configuration Example
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Desktop Browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile Viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // Branded Browsers
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
});
```

### Running Tests
```bash
# Run all projects
npx playwright test

# Run specific project
npx playwright test --project=firefox
```

## Browser-Specific Details

### Chromium
- Uses open-source Chromium builds
- Supports headless shell for CI (`--only-shell`)
- New headless mode available via 'chromium' channel
- Typically ahead of branded browsers

### Firefox
- Matches recent Firefox Stable build
- Feature availability may vary by OS
- Requires Playwright-patched version

### WebKit
- Based on latest WebKit main branch
- Platform-dependent features
- Best Safari-like experience on macOS

### Branded Browsers (Chrome/Edge)
- Available channels: chrome, msedge, chrome-beta, msedge-beta, etc.
- Can be installed via `npx playwright install msedge`
- May be affected by Enterprise Browser Policies
- Better for codec support and regression testing

## Installation Behind Firewalls/Proxies

### Proxy Configuration
```bash
# Using HTTPS proxy
HTTPS_PROXY=https://192.0.2.1 npx playwright install

# Custom certificates
export NODE_EXTRA_CA_CERTS="/path/to/cert.pem"

# Increase timeout
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 npx playwright install
```

### Custom Download Location
```bash
# Custom download host
PLAYWRIGHT_DOWNLOAD_HOST=http://192.0.2.1 npx playwright install

# Browser-specific hosts
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=http://203.0.113.3 npx playwright install
```

## Browser Management

### Default Locations
- Windows: `%USERPROFILE%\AppData\Local\ms-playwright`
- macOS: `~/Library/Caches/ms-playwright`
- Linux: `~/.cache/ms-playwright`

### Custom Browser Path
```bash
# Set custom browser path
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright install

# Hermetic installation
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install
```

### Maintenance
```bash
# Remove current installation browsers
npx playwright uninstall

# Remove all Playwright browsers
npx playwright uninstall --all
```

### Auto-Cleanup
- Automatic garbage collection of unused browsers
- Disable with `PLAYWRIGHT_SKIP_BROWSER_GC=1`

## Browser API Reference

### Basic Usage
```javascript
const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await browser.close();
})();
```

### Core Methods
- `browser.browserType()` - Returns browser type (chromium/firefox/webkit)
- `browser.close([options])` - Closes browser and all pages
- `browser.contexts()` - Returns array of all open browser contexts
- `browser.isConnected()` - Indicates browser connection status
- `browser.version()` - Returns browser version
- `browser.newBrowserCDPSession()` - Creates CDP session (Chromium only)

### Context Management
```javascript
// Create context with options
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  userAgent: 'Custom UA',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['geolocation'],
  httpCredentials: { username: 'user', password: 'pass' },
  offline: false,
  colorScheme: 'dark'
});

// Create page in new context
const page = await browser.newPage(/* same options as newContext */);
```

### Recording & Tracing
```javascript
// Record HAR
await browser.newContext({
  recordHar: {
    path: 'trace.har',
    mode: 'minimal'
  }
});

// Record video
await browser.newContext({
  recordVideo: {
    dir: 'videos/',
    size: { width: 1280, height: 720 }
  }
});

// Chromium tracing
await browser.startTracing(page, { 
  path: 'trace.json',
  screenshots: true 
});
await browser.stopTracing();
```

### Events
- `disconnected` - Emitted when browser disconnects (crash/close)

### Best Practices
- Use `browser.newContext()` for isolated sessions
- Always await `context.close()` before `browser.close()`
- Prefer `newContext()` + `context.newPage()` over `newPage()` for production
- Handle the 'disconnected' event for crash recovery
