# Integration Plan: Using Configuration Options from config.ts in browser.ts

## Overview

This document outlines the plan to integrate the configuration system defined in `config.ts` into `browser.ts`, replacing hardcoded configuration values with the centralized configuration options.

## Current State Assessment

### In browser.ts:
- Already imports and calls `getConfig()` from config.ts
- Uses hardcoded browser launch options in the `setupBrowser()` function:
  - `headless: false`
  - `ignoreDefaultArgs: ["--enable-automation"]`
  - `args: ["--no-default-browser-check"]`
- Hardcodes profile directory path using xdg.darwin()

### In config.ts:
- Provides a comprehensive configuration system with:
  - Environment variables and CLI argument support
  - Browser-specific options including HEADLESS, PROFILE_DIR, IGNORE_DEFAULT_ARGS, BROWSER_ARGS
  - A helper function `getBrowserLaunchOptions(config)` to extract browser-specific options

## Implementation Plan

1. **Replace Profile Directory Path**:
   - Replace the hardcoded profile directory path in `setupBrowser()` with `config.PROFILE_DIR`
   - Remove the direct xdg.darwin() call since the config already handles default paths

2. **Use Browser Launch Options from Config**:
   - Replace the hardcoded browser launch options with values from config
   - Use the `getBrowserLaunchOptions()` helper function from config.ts

3. **Apply Browser Options to launchPersistentContext**:
   - Update the `chromium.launchPersistentContext()` call to use the configuration values

4. **Maintain Viewport Setting**:
   - The `viewport: null` setting doesn't appear in config.ts but seems important
   - Consider adding this to config.ts or keep it hardcoded if it's a fixed requirement

5. **Update Any HTTP Server Configuration**:
   - Ensure the HTTP server in browser.ts uses the PORT configuration from config.ts

## Code Changes Summary

The primary modification will be to the `setupBrowser()` function, replacing:

```typescript
const dirs = xdg.darwin();
const configDir = join(dirs.config, "playwright", "profile");

// Create the dir, if it doesn't exist
await Deno.mkdir(configDir, { recursive: true });

browserContext = await chromium.launchPersistentContext(configDir, {
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--no-default-browser-check"],
});
```

With:

```typescript
const browserOptions = getBrowserLaunchOptions(config);

// Create the dir, if it doesn't exist
await Deno.mkdir(browserOptions.profileDir, { recursive: true });

browserContext = await chromium.launchPersistentContext(browserOptions.profileDir, {
  headless: browserOptions.headless,
  viewport: null, // Maintain this setting
  ignoreDefaultArgs: browserOptions.ignoreDefaultArgs,
  args: browserOptions.args,
});
```

This approach leverages the existing configuration system while maintaining any browser-specific requirements.

## Benefits

1. **Centralized Configuration**: All configuration parameters are defined and validated in one place
2. **Command-line Flexibility**: Users can override settings via CLI arguments
3. **Environment Variable Support**: Configuration can be set via environment variables
4. **Type Safety**: The TypeScript types ensure configuration is used correctly
5. **Validation**: Zod schema in config.ts validates all configuration values
