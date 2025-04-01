// persistent-login.ts
import { chromium } from "playwright";
import xdg from "@folder/xdg";
import { join } from "std/path";

(async () => {
  const dirs = xdg.darwin();
  const configDir = join(dirs.config, "playwright", "profile");

  // Create the dir, if it doesn't exist
  await Deno.mkdir(configDir, { recursive: true });

  const browser = await chromium.launchPersistentContext(configDir, {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
    //   '--disable-infobars',
    //   '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check'
    ],
    // userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await browser.newPage();
  await page.goto("https://jsr.io");

  // Optional: don't close the browser so you can interact
  // await browser.close(); // if you want to close
})();
