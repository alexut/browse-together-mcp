// config.ts - Unified configuration system for environment variables and CLI arguments
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";
import * as path from "std/path";
import xdg from "@folder/xdg";
import { parseArgs } from "std/cli/parse-args";

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

// Define a constant schema using Zod
const configSchema = z.object({
  APP_ENV: presets.appEnv(),

  LOG_LEVEL: envVar(z.enum(["debug", "info", "warn", "error"]), {
    default: "debug",
    description: "Logging verbosity level",
  }),
  PORT: envVar(z.coerce.number().int().positive().max(65535), {
    default: 8888,
    description: "HTTP port for the proxy service",
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
    z.string().transform(jsonTransformer(["--no-default-browser-check"])),
    {
      default: ["--no-default-browser-check"],
      description: "Additional browser launch arguments as JSON array",
    },
  ),
  BROWSER_OPTIONS: envVar(
    z.string().transform(jsonTransformer({})),
    {
      default: "{}",
      description: "Additional browser launch options as JSON string",
    },
  ),
});

type Config = z.infer<typeof configSchema>;

// Environment variable loading
export function loadEnvironmentConfig(
  schema = configSchema,
  environment: Record<string, string> = Deno.env.toObject(),
): { env: Config; warnings: string[] } {
  const result = loadEnv(schema, {
    exitOnError: false,
    env: environment,
  });

  // Ensure the result is of type Config
  const env = result.env as unknown as Config;
  return { env, warnings: result.warnings };
}

// Auto-generate CLI options from schema
export function defineCliOptions(
  schema: Config = loadEnvironmentConfig().env,
): {
  flag: string;
  aliases?: string[];
  description: string;
  type: string;
  default: unknown;
  envVar: string;
}[] {
  const options: {
    flag: string;
    aliases?: string[];
    description: string;
    type: string;
    default: unknown;
    envVar: string;
  }[] = [];

  function processSchemaSection(section: Record<string, any>, prefix = "") {
    for (const [key, value] of Object.entries(section)) {
      if (!value || typeof value !== "object" || !("description" in value)) {
        if (typeof value === "object" && value !== null) {
          processSchemaSection(value, prefix ? `${prefix}-${key}` : key);
        }
        continue;
      }

      const flag = prefix
        ? `${prefix}-${key.toLowerCase().replace(/_/g, "-")}`
        : key.toLowerCase().replace(/_/g, "-");

      options.push({
        flag,
        aliases: key.length > 3 && !prefix ? [key[0].toLowerCase()] : undefined,
        description: value.description,
        type: typeof value.default === "boolean"
          ? "boolean"
          : typeof value.default === "number"
          ? "number"
          : "string",
        default: schema[key],
        envVar: key,
      });
    }
  }

  processSchemaSection(schema);

  return options;
}

// CLI parser configuration
export function buildCliParserOptions(
  cliOptions: {
    flag: string;
    aliases?: string[];
    description: string;
    type: string;
    default: unknown;
    envVar: string;
  }[],
): {
  string: string[];
  boolean: string[];
  alias: Record<string, string[]>;
  default: Record<string, unknown>;
  negatable: string[];
} {
  const options = {
    string: [] as string[],
    boolean: [] as string[],
    alias: {} as Record<string, string[]>,
    default: {} as Record<string, unknown>,
    negatable: [] as string[],
  };

  for (const option of cliOptions) {
    if (option.type === "boolean") {
      options.boolean.push(option.flag);
      options.negatable.push(option.flag);
    } else {
      options.string.push(option.flag);
    }

    if (option.aliases && option.aliases.length > 0) {
      options.alias[option.flag] = option.aliases;
    }

    if (option.default !== undefined) {
      options.default[option.flag] = option.default;
    }
  }

  options.boolean.push("help");
  options.alias.help = ["?"];

  return options;
}

// CLI argument parsing
export function parseCliArguments(
  args: string[] = Deno.args,
  options: {
    string: string[];
    boolean: string[];
    alias: Record<string, string[]>;
    default: Record<string, unknown>;
    negatable: string[];
  },
): { [key: string]: unknown } {
  return parseArgs(args, options);
}

// Help text generation
export function generateHelpText(
  cliOptions: {
    flag: string;
    aliases?: string[];
    description: string;
    type: string;
    default: unknown;
    envVar: string;
  }[],
): void {
  console.log("Usage: [options]");
  for (const option of cliOptions) {
    console.log(`--${option.flag} (${option.type}): ${option.description}`);
  }
}

// Configuration merging (env + CLI)
export function mergeConfiguration(
  envConfig: Config,
  cliArgs: { [key: string]: unknown },
): Config {
  const config: Config = { ...envConfig };

  for (const key in cliArgs) {
    if (cliArgs[key] !== undefined && key in config) {
      (config as any)[key] = cliArgs[key];
    }
  }

  return config;
}

// The main function to get configuration
export function getConfig(
  environment: Record<string, string> = Deno.env.toObject(),
  args: string[] = Deno.args,
): Config | null {
  const envConfig =
    loadEnvironmentConfig(defineConfigSchema(), environment).env;
  const cliOptions = defineCliOptions(envConfig);
  const parserOptions = buildCliParserOptions(cliOptions);
  const cliArgs = parseCliArguments(args, parserOptions);

  if (cliArgs.help) {
    generateHelpText(cliOptions);
    return null;
  }

  return mergeConfiguration(envConfig, cliArgs);
}

// Browser-specific options helper
export function getBrowserLaunchOptions(
  config: Config | null,
): {
  headless: boolean;
  profileDir: string;
  ignoreDefaultArgs: string[];
  args: string[];
  options: Record<string, unknown>;
} | null {
  if (!config) return null;

  return {
    headless: config.browser.HEADLESS,
    profileDir: config.browser.PROFILE_DIR,
    ignoreDefaultArgs: config.browser.IGNORE_DEFAULT_ARGS,
    args: config.browser.BROWSER_ARGS,
    options: config.browser.BROWSER_OPTIONS,
  };
}

// Maintain backward compatibility with a default export
let defaultConfig: Config | null = null;

export function initializeDefaultConfig(): Config | null {
  defaultConfig = getConfig();
  return defaultConfig;
}

export default defaultConfig || initializeDefaultConfig();
