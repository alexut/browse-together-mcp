// config.ts - Unified configuration system for environment variables and CLI arguments
import { z } from "zod";
import {
  envVar,
  type LoadEnvOptions,
  presets,
  validateEnv,
} from "@canadaduane/ts-env";
import * as path from "@std/path";
import xdg from "@folder/xdg";
import { parseArgs } from "@std/cli/parse-args";

// Helper for JSON parsing (eliminate duplication)
function jsonTransformer<T>(defaultValue: T) {
  return (str: string): T => {
    if (!str) return defaultValue;
    try {
      return JSON.parse(str);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  };
}

// Define the environment schema as the single source of truth
const envSchema = z.object({
  APP_ENV: presets.appEnv(),
  BROWSER_TYPE: envVar(z.enum(['chromium', 'firefox']), {
    default: 'chromium',
    description: 'Browser type to use (chromium or firefox)',
  }),
  LOG_LEVEL: envVar(z.enum(["debug", "info", "warn", "error"]), {
    default: "debug",
    description: "Logging verbosity level",
  }),
  PORT: envVar(z.coerce.number().int().positive().max(65535), {
    default: 8888,
    description: "HTTP port for the proxy service",
  }),
  BROWSER_API_TOKEN: envVar(z.string().min(32), {
    // No default - must be explicitly provided
    description: "Secret token for authenticating with the Browser Proxy Service API",
  }),
  HEADLESS: presets.booleanFlag({
    default: false,
    description: "Whether to run browser in headless mode",
  }),
  PROFILE_DIR: envVar(z.string(), {
    default: path.join(xdg.darwin().config, "playwright", "profile"),
    description: "Absolute path to the browser profile directory",
  }),
  IGNORE_DEFAULT_ARGS: envVar(
    z.string().transform(jsonTransformer(["--enable-automation"])),
    {
      default: ["--enable-automation"],
      description: "Default browser arguments to ignore as JSON array",
    },
  ),
  BROWSER_ARGS: envVar(
    z.string().transform(jsonTransformer([
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=site-per-process",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-default-apps",
      "--no-sandbox",
      "--disable-translate",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream"
    ])),
    {
      default: [
        "--no-default-browser-check",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=site-per-process",
        "--disable-extensions",
        "--disable-component-extensions-with-background-pages",
        "--disable-default-apps",
        "--no-sandbox",
        "--disable-translate",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream"
      ],
      description: "Custom browser arguments as JSON array for enhanced stealth",
    },
  ),
});

// Type inference from schema
export type EnvConfig = z.infer<typeof envSchema>;

// Define the mapping as an array of triples: [envKey, cliKey, shortAlias]
export const configMapping: [keyof EnvConfig, string, string | undefined][] = [
  ["APP_ENV", "app-env", "e"],
  ["BROWSER_TYPE", "browser-type", "t"],
  ["LOG_LEVEL", "log-level", "l"],
  ["PORT", "port", "p"],
  ["BROWSER_API_TOKEN", "browser-api-token", undefined], // No short alias for security
  ["HEADLESS", "headless", "h"],
  ["PROFILE_DIR", "profile-dir", "d"],
  ["IGNORE_DEFAULT_ARGS", "ignore-default-args", "i"],
  ["BROWSER_ARGS", "browser-args", "b"],
];

// Extract aliases for CLI argument parsing
const cliAliases = Object.fromEntries(
  configMapping
    .filter(([_, __, shortAlias]) => shortAlias !== undefined)
    .map(([_, cliKey, shortAlias]) => [cliKey, shortAlias]),
);

// Parse CLI arguments and transform to envSchema format
// Return type uses string values since CLI args are always strings at this stage
// Type conversion happens later during schema validation
export function parseCliArguments(
  args: string[] = Deno.args,
): Partial<Record<keyof EnvConfig, string>> {
  const rawArgs = parseArgs(args, { alias: cliAliases });
  // Use the correct type that matches our return type
  const transformedArgs: Partial<Record<keyof EnvConfig, string>> = {};

  for (const [envKey, cliKey, _] of configMapping) {
    if (rawArgs[cliKey] !== undefined) {
      // CLI arguments are always strings at this stage
      transformedArgs[envKey] = String(rawArgs[cliKey]);
    }
  }

  return transformedArgs;
}

// Merge configurations with CLI taking precedence
export function mergeConfiguration(
  envConfig: EnvConfig,
  cliArgs: Partial<EnvConfig>,
): EnvConfig {
  return { ...envConfig, ...cliArgs };
}

// Get raw environment variables without validation
function getRawEnvVars(env?: LoadEnvOptions["env"]): Record<string, string> {
  const processEnv = env || Deno.env;
  const rawEnvVars: Record<string, string> = {};

  // Extract only the keys defined in our envSchema
  for (const key of Object.keys(envSchema.shape)) {
    // Handle the case where processEnv might not have a get method
    let value: string | undefined;
    if (typeof processEnv.get === "function") {
      value = processEnv.get(key);
    } else if (typeof processEnv === "object" && processEnv !== null) {
      // In case it's a regular object
      value = (processEnv as Record<string, string | undefined>)[key];
    }

    if (value !== undefined) {
      rawEnvVars[key] = value;
    }
  }

  return rawEnvVars;
}

// Get the final configuration
export function getConfig(
  { env, args }: { env?: LoadEnvOptions["env"]; args?: string[] } = {},
): EnvConfig {
  // Get raw environment variables (without validation)
  const rawEnvVars = getRawEnvVars(env);

  // Parse CLI arguments (will be strings)
  const cliArgs = parseCliArguments(args);

  // Merge raw values (both are string values at this point)
  const mergedRawConfig = { ...rawEnvVars, ...cliArgs };

  // Apply schema validation using validateEnv for better error messages
  // We're using the library's error formatting while maintaining our custom merging logic
  return validateEnv(envSchema, {
    env: mergedRawConfig as Record<string, string>,
    // The library will handle exiting on error with nice formatting
    exitOnError: true,
  });
}

// Browser-specific options helper
export function getBrowserLaunchOptions(config: EnvConfig) {
  return {
    headless: config.HEADLESS,
    profileDir: config.PROFILE_DIR,
    ignoreDefaultArgs: config.IGNORE_DEFAULT_ARGS,
    args: config.BROWSER_ARGS,
  };
}
