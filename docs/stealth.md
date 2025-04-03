# Stealth Mode

Gmail (and Google in general) is very good at detecting automation, even if you're using the same IP and running on the same machine as your normal browser. Here are some ways Gmail might be detecting that you’re using Playwright:

🔍 1. Missing or Altered Browser Fingerprint

Even though Playwright Chromium is based on real Chromium, its browser fingerprint (canvas data, WebGL, audio context, etc.) is not exactly the same as a real Chrome browser. Gmail runs tons of fingerprinting scripts to detect subtle differences.

    User-Agent mismatch

    Missing or modified WebGL vendor/renderer

    Languages array

    Plugins list

    Touch support / device memory / hardware concurrency

🧠 2. Navigator Object Tells on You

By default, navigator.webdriver is set to true in automation tools like Playwright and Selenium. Gmail may check for this.

console.log(navigator.webdriver); // true => bot detected

Although you can patch this using Playwright's stealth plugin (see below), it’s one of many giveaways.

🐭 3. No Real User Interaction

Gmail (and other high-security apps) look for realistic mouse movement, keypress delays, scroll behavior, etc. Bots usually send interactions programmatically, which creates a "robotic" signature.

🧪 4. Playwright Detection by JavaScript Features

Sites can check for other automation indicators, like:

    Presence of window.chrome.runtime (should exist in real Chrome)

    Subtle quirks in things like permissions.query({ name: 'notifications' })

    Timing anomalies in requestAnimationFrame or performance.now()

🛡️ 5. Security Challenges (CAPTCHA, 2FA, Heuristics)

If you've logged in too many times recently, or from a new user agent (Playwright's), Gmail might increase the security level. Even with the same IP, a suspicious User-Agent or behavior can trigger a challenge.
🛠️ What You Can Try:

You’ll want to make your Playwright browser act as much like a real browser as possible.
👉 Use playwright-extra and stealth plugin:

npm install playwright-extra puppeteer-extra-plugin-stealth

Then:

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://mail.google.com');
})();

This plugin tries to mimic human-like behavior and patch common detection points.

🔐 Important Note:

Even with stealth, Google is particularly aggressive about automation and login protection. Automating Gmail login often fails, and even if it works once, you may get your account flagged.

playwright-extra GitHub Workflow Status Discord npm

    A modular plugin framework for playwright to enable cool plugins through a clean interface.

Installation

yarn add playwright playwright-extra
# - or -
npm install playwright playwright-extra

Changelog

Quickstart

// playwright-extra is a drop-in replacement for playwright,
// it augments the installed playwright with plugin functionality
const { chromium } = require('playwright-extra')

// Load the stealth plugin and use defaults (all tricks to hide playwright usage)
// Note: playwright-extra is compatible with most puppeteer-extra plugins
const stealth = require('puppeteer-extra-plugin-stealth')()

// Add the plugin to playwright (any number of plugins can be added)
chromium.use(stealth)

// That's it, the rest is playwright usage as normal 😊
chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()

  console.log('Testing the stealth plugin..')
  await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'stealth.png', fullPage: true })

  console.log('All done, check the screenshot. ✨')
  await browser.close()
})

The above example uses the compatible stealth plugin from puppeteer-extra, that plugin needs to be installed as well:

yarn add puppeteer-extra-plugin-stealth
# - or -
npm install puppeteer-extra-plugin-stealth

If you'd like to see debug output just run your script like so:

# macOS/Linux (Bash)
DEBUG=playwright-extra*,puppeteer-extra* node myscript.js

# Windows (Powershell)
$env:DEBUG='playwright-extra*,puppeteer-extra*';node myscript.js

More examples
TypeScript & ESM usage

Using different browsers

Multiple instances with different plugins

Plugins

We're currently in the process of making the existing puppeteer-extra plugins compatible with playwright-extra, the following plugins have been successfully tested already:
🔥 puppeteer-extra-plugin-stealth

    Applies various evasion techniques to make detection of an automated browser harder
    Compatible with Puppeteer & Playwright and chromium based browsers

  Example: Using stealth in Playwright with custom options

🏴 puppeteer-extra-plugin-recaptcha

    Solves reCAPTCHAs and hCaptchas automatically, using a single line of code: page.solveRecaptchas()
    Compatible with Puppeteer & Playwright and all browsers (chromium, firefox, webkit)

  Example: Solving captchas in Playwright & Firefox

🆕 plugin-proxy-router

    Use multiple proxies dynamically with flexible per-host routing and more
    Compatible with Puppeteer & Playwright and all browsers (chromium, firefox, webkit)

Notes

    If you're in need of adblocking use this package or block resources natively
    We're focussing on compatiblity with existing plugins at the moment, more documentation on how to write your own playwright-extra plugins will follow
