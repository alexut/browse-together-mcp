# Chromium Stealth Mode Implementation Plan

## Overview

This document outlines a plan to enhance our Browse Together MCP application with improved anti-detection measures when using Chromium browser. Since our application runs browsers with `headless: false` and is primarily operated by humans, we want to ensure that automated browsing remains indistinguishable from regular human browsing.

> **Update**: Based on latest findings, we'll be using playwright-extra with puppeteer-extra-plugin-stealth, which is the recommended and most compatible approach according to the playwright-extra documentation.

## Problem Statement

Web services, particularly sophisticated ones like Google, employ multiple techniques to detect and block automated browsers. These detection methods include:

1. **Browser Fingerprinting** - Detection of non-standard canvas data, WebGL information, audio context, etc.
2. **Navigator Object Detection** - Checking for `navigator.webdriver` flag
3. **User Interaction Analysis** - Looking for inhuman mouse movements and interaction patterns
4. **JavaScript Feature Detection** - Testing for presence of expected browser-specific objects and methods
5. **Timing Analysis** - Detecting anomalies in timing functions like `requestAnimationFrame`
6. **Security Challenges** - Triggering CAPTCHAs or additional verification steps

## Implementation Plan

### 1. Integrate Playwright-Extra with Stealth Plugin

The most effective approach is to integrate the `playwright-extra` library with the `playwright-extra-plugin-stealth` which is specifically designed to circumvent most common detection techniques.

#### Configuration Changes

Update our dependencies to include:

```bash
# Install playwright-extra and the puppeteer stealth plugin
npm install playwright-extra puppeteer-extra-plugin-stealth
# or with deno
deno add npm:playwright-extra npm:puppeteer-extra-plugin-stealth
```

#### Browser.ts Implementation

Modify the browser.ts file to use the stealth-enhanced version of Playwright:

```typescript
// Replace
import { chromium, firefox } from "playwright";

// With
import { firefox } from "playwright";
import { chromium } from "npm:playwright-extra";
import stealth from "npm:puppeteer-extra-plugin-stealth";

// Then, in browser initialization logic, use:
let browserType;
if (config.BROWSER_TYPE === 'firefox') {
  browserType = firefox;
} else {
  // Apply stealth plugin only for Chromium
  // Note: puppeteer-extra-plugin-stealth is compatible with playwright-extra
  chromium.use(stealth());
  browserType = chromium;
}
```

### 2. Enhanced Browser Arguments Configuration

Update the config.ts to include additional browser arguments that help with anti-detection:

```typescript
// Add these to the default BROWSER_ARGS in config.ts
const defaultChromiumArgs = [
  "--no-default-browser-check",
  "--disable-blink-features=AutomationControlled",
  "--disable-features=site-per-process",
  "--disable-extensions",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--no-sandbox",
  "--disable-translate",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];
```

### 3. WebDriver Flag Evasion

The stealth plugin should handle this, but we can add an additional check:

```typescript
// Add a page initialization hook after creating a new page
async function initializePage(page) {
  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    delete Object.getPrototypeOf(navigator).webdriver;
  });
  
  return page;
}

// Apply in getOrCreatePage function
const page = await browserContext.newPage();
await initializePage(page);
```

### 4. User-Agent Consistency

Ensure the User-Agent string is consistent and matches a common browser:

```typescript
// Add to page initialization
await page.setExtraHTTPHeaders({
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
});
```

### 5. WebGL and Canvas Fingerprinting Protection

```typescript
// Add to page initialization
await page.evaluateOnNewDocument(() => {
  // Canvas fingerprinting
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
    const context = getContext.call(this, contextType, ...args);
    if (contextType === '2d') {
      const getImageData = context.getImageData;
      context.getImageData = function(...args) {
        const imageData = getImageData.call(this, ...args);
        // Add minor noise to the image data
        for (let i = 0; i < imageData.data.length; i += 4) {
          // Small random adjustments to r,g,b values
          imageData.data[i] += Math.floor(Math.random() * 2);
          imageData.data[i+1] += Math.floor(Math.random() * 2);
          imageData.data[i+2] += Math.floor(Math.random() * 2);
        }
        return imageData;
      };
    }
    return context;
  };

  // WebGL fingerprinting
  const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    // Spoof vendor and renderer info
    if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
      return 'Intel Inc.';
    }
    if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
      return 'Intel Iris OpenGL Engine';
    }
    return originalGetParameter.call(this, parameter);
  };
});
```

### 6. Permissions and Feature Policy Handling

```typescript
// Add to page initialization
await page.evaluateOnNewDocument(() => {
  // Fix permissions API if detected
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = function(parameters) {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return originalQuery.call(this, parameters);
    };
  }
});
```

## Testing and Verification

After implementation, we should verify the stealth mode effectiveness using:

1. **Browser Fingerprinting Tests**:
   - Use https://bot.sannysoft.com/ (recommended by playwright-extra documentation)
   - Use https://fingerprintjs.com/demo/
   - Use https://browserleaks.com/
   
   For advanced debugging, we can use:
   ```bash
   # macOS/Linux (Bash)
   DEBUG=playwright-extra*,puppeteer-extra* node myscript.js
   
   # Windows (Powershell)
   $env:DEBUG='playwright-extra*,puppeteer-extra*';node myscript.js
   ```

2. **Manual Testing**:
   - Login to high-security sites like Google and banking applications
   - Access sites known for bot detection

## Human Usability Considerations

Since the browser is primarily operated by humans with `headless: false`:

1. **Minimize Visual Artifacts**: Ensure stealth measures don't affect visible rendering
2. **Maintain Normal Interaction**: Don't interfere with normal user interactions
3. **Performance Impact**: Monitor and minimize any performance degradation from stealth measures

## Implementation Phases

1. **Phase 1**: Basic integration of playwright-extra with stealth plugin
2. **Phase 2**: Add additional browser arguments and basic evasion techniques
3. **Phase 3**: Implement advanced fingerprinting protection
4. **Phase 4**: Testing and refinement

## Limitations and Future Improvements

- Anti-detection is an arms race; these measures may need updates as detection techniques evolve
- Some highly secure services may still detect automation through sophisticated means
- Consider adding randomized timing for automated actions to better mimic human behavior
- Explore hardware-level fingerprinting evasion for future enhancements

## Additional Plugins to Consider

In the future, we might want to integrate additional plugins that are compatible with playwright-extra:

1. **puppeteer-extra-plugin-recaptcha**
   - Solves reCAPTCHAs and hCaptchas automatically with `page.solveRecaptchas()`
   - Compatible with all browsers (chromium, firefox, webkit)

2. **plugin-proxy-router**
   - Enables use of multiple proxies dynamically with flexible per-host routing
   - Compatible with all browsers (chromium, firefox, webkit)

3. **Ad Blocking**
   - For ad blocking functionality, consider using a dedicated package or block resources natively

## Conclusion

By implementing these stealth measures, our Browse Together MCP application should significantly reduce the likelihood of being detected as an automated browser while maintaining full functionality for human operators. These techniques will help ensure a more consistent and reliable browsing experience across various web services.
