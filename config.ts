// config.ts
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";
import * as path from "std/path";
import xdg from "@folder/xdg";

// Determine environment
const appEnv = Deno.env.get("APP_ENV") || "development";
const isProduction = appEnv === "production";

// Define configuration schema with validation and defaults
export const { env, warnings } = loadEnv({
  // Basic configuration
  APP_ENV: presets.appEnv(),
  LOG_LEVEL: envVar(
    z.enum(["debug", "info", "warn", "error"])
      .superRefine((val, ctx) => {
        if (isProduction && val === "debug") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Debug logging is not allowed in production",
          });
        }
      }),
    {
      default: isProduction ? "info" : "debug",
      description: "Logging verbosity level",
    }
  ),
  
  // Server configuration
  PORT: envVar(z.coerce.number().int().positive().max(65535), { 
    default: 8888,
    description: "HTTP port for the proxy service"
  }),
  
  // Playwright configuration
  HEADLESS: presets.booleanFlag({
    default: isProduction,
    description: "Whether to run browser in headless mode"
  }),
  
  PROFILE_DIR: envVar(z.string(), {
    default: path.join(xdg.darwin().config, "playwright", "profile"),
    description: "Absolute path to the browser profile directory"
  }),
  
  // Advanced browser options
  IGNORE_DEFAULT_ARGS: envVar(
    z.string().transform((str) => {
      try {
        return str ? JSON.parse(str) : ["--enable-automation"];
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new Error(`Invalid JSON in IGNORE_DEFAULT_ARGS: ${error.message}`);
      }
    }),
    {
      default: JSON.stringify(["--enable-automation"]),
      description: "Default browser arguments to ignore as JSON array"
    }
  ),

  BROWSER_ARGS: envVar(
    z.string().transform((str) => {
      try {
        return str ? JSON.parse(str) : ["--no-default-browser-check"];
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new Error(`Invalid JSON in BROWSER_ARGS: ${error.message}`);
      }
    }),
    {
      default: JSON.stringify(["--no-default-browser-check"]),
      description: "Additional browser launch arguments as JSON array"
    }
  ),
  
  // Advanced browser options (as JSON string for flexibility)
  BROWSER_OPTIONS: envVar(
    z.string().transform((str) => {
      try {
        return str ? JSON.parse(str) : {};
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        throw new Error(`Invalid JSON in BROWSER_OPTIONS: ${error.message}`);
      }
    }),
    {
      default: "{}",
      description: "Additional browser launch options as JSON string"
    }
  ),
}, {
  exitOnError: true, // Fail fast on invalid configuration
});

// Log any warnings but continue execution
if (warnings.length > 0) {
  console.warn("Configuration warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

// Convenience method to get complete browser launch options
export function getBrowserLaunchOptions() {
  return {
    headless: env.HEADLESS,
    viewport: null,
    ignoreDefaultArgs: env.IGNORE_DEFAULT_ARGS,
    args: env.BROWSER_ARGS,
    ...env.BROWSER_OPTIONS
  };
}

// Export typed configuration object
export type Config = typeof env;

// Export a single default configuration object for import throughout the application
export default env;
