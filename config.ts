// config.ts - Unified configuration system for environment variables and CLI arguments
import { envVar, loadEnv, presets } from "@canadaduane/ts-env";
import { z } from "zod";
import * as path from "std/path";
import xdg from "@folder/xdg";
import { parseArgs } from "std/cli/parse-args";

// Determine environment
const appEnv = Deno.env.get("APP_ENV") || "development";
const isProduction = appEnv === "production";

// Define the environment variable schema with validation and defaults
const envSchema = {
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
};

// Step 1: Load environment variables
const { env: envConfig, warnings } = loadEnv(envSchema, {
  exitOnError: false, // Handle errors manually for better messages
});

// Step 2: Define CLI option mapping to environment variables
interface CliOption {
  flag: string;
  aliases?: string[];
  description: string;
  type: "string" | "boolean" | "number";
  default?: unknown;
  envVar: string;
}

// CLI configuration that maps to environment variables
const cliOptions: CliOption[] = [
  {
    flag: "log-level",
    aliases: ["l"],
    description: "Set logging verbosity (debug, info, warn, error)",
    type: "string",
    default: envConfig.LOG_LEVEL,
    envVar: "LOG_LEVEL"
  },
  {
    flag: "port",
    aliases: ["p"],
    description: "HTTP port for the proxy service",
    type: "number",
    default: envConfig.PORT,
    envVar: "PORT"
  },
  {
    flag: "headless",
    aliases: ["h"],
    description: "Run browser in headless mode",
    type: "boolean",
    default: envConfig.HEADLESS,
    envVar: "HEADLESS"
  },
  {
    flag: "profile-dir",
    description: "Absolute path to the browser profile directory",
    type: "string",
    default: envConfig.PROFILE_DIR,
    envVar: "PROFILE_DIR"
  },
  {
    flag: "ignore-default-args",
    description: "Default browser arguments to ignore (JSON array)",
    type: "string",
    default: JSON.stringify(envConfig.IGNORE_DEFAULT_ARGS),
    envVar: "IGNORE_DEFAULT_ARGS"
  },
  {
    flag: "browser-args",
    description: "Additional browser launch arguments (JSON array)",
    type: "string",
    default: JSON.stringify(envConfig.BROWSER_ARGS),
    envVar: "BROWSER_ARGS"
  },
  {
    flag: "browser-options",
    description: "Additional browser launch options (JSON string)",
    type: "string",
    default: JSON.stringify(envConfig.BROWSER_OPTIONS),
    envVar: "BROWSER_OPTIONS"
  }
];

// Step 3: Build CLI parser configuration
const cliParserOptions = {
  string: [] as string[],
  boolean: [] as string[],
  alias: {} as Record<string, string[]>,
  default: {} as Record<string, unknown>,
  negatable: [] as string[]
};

// Populate CLI parser options from our defined mapping
for (const option of cliOptions) {
  if (option.type === "boolean") {
    cliParserOptions.boolean.push(option.flag);
    cliParserOptions.negatable.push(option.flag);
  } else {
    cliParserOptions.string.push(option.flag);
  }
  
  if (option.aliases && option.aliases.length > 0) {
    cliParserOptions.alias[option.flag] = option.aliases;
  }
  
  if (option.default !== undefined) {
    cliParserOptions.default[option.flag] = option.default;
  }
}

// Add help flag
cliParserOptions.boolean.push("help");
cliParserOptions.alias.help = ["?"];

// Step 4: Parse CLI arguments
const cliArgs = parseArgs(Deno.args, cliParserOptions);

// Step 5: Generate help text if requested
function generateHelpText() {
  console.log("Usage: deno run --allow-net --allow-read --allow-env browser.ts [options]");
  console.log("");
  console.log("Options:");
  
  // Add help flag first
  console.log("  --help, -?\t\tShow this help message");
  
  // Add all other CLI options
  for (const option of cliOptions) {
    const aliases = option.aliases && option.aliases.length > 0
      ? `, -${option.aliases.join(", -")}` 
      : "";
    const defaultValue = option.default !== undefined 
      ? ` (default: ${JSON.stringify(option.default)})` 
      : "";
    
    console.log(`  --${option.flag}${aliases}\t${option.description}${defaultValue}`);
  }
  
  console.log("");
  console.log("Environment variables can also be used for configuration.");
}

// Display help if requested
if (cliArgs.help) {
  generateHelpText();
  Deno.exit(0);
}

// Step 6: Merge configurations with precedence: CLI > Env > Defaults
const config = { ...envConfig };

// Apply CLI argument overrides when present
for (const option of cliOptions) {
  const cliValue = cliArgs[option.flag];
  
  // Only override if CLI arg was explicitly provided
  if (cliValue !== undefined) {
    // Handle type conversion
    // Using type assertion to safely assign to config object with string index
    const configAsRecord = config as Record<string, unknown>;
    
    if (option.type === "number" && typeof cliValue === "string") {
      configAsRecord[option.envVar] = Number(cliValue);
    } else if (option.type === "boolean") {
      configAsRecord[option.envVar] = Boolean(cliValue);
    } else if (option.type === "string" && 
              (option.flag === "ignore-default-args" || 
               option.flag === "browser-args" || 
               option.flag === "browser-options")) {
      // Handle JSON parsing for special cases
      try {
        // Using type assertion to safely assign to config object with string index
        const configAsRecord = config as Record<string, unknown>;
        configAsRecord[option.envVar] = typeof cliValue === "string" ? JSON.parse(cliValue) : cliValue;
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Invalid JSON in ${option.flag}: ${error.message}`);
      }
    } else {
      // Using type assertion to safely assign to config object with string index
      const configAsRecord = config as Record<string, unknown>;
      configAsRecord[option.envVar] = cliValue;
    }
  }
}

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
    headless: config.HEADLESS as boolean,
    viewport: null,
    ignoreDefaultArgs: config.IGNORE_DEFAULT_ARGS as string[],
    args: config.BROWSER_ARGS as string[],
    ...(config.BROWSER_OPTIONS as Record<string, unknown>)
  };
}

// Export a function to display the active configuration
export function logActiveConfiguration() {
  console.log("Active configuration:");
  for (const [key, value] of Object.entries(config)) {
    console.log(`- ${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : value}`);
  }
}

// Export typed configuration object
export type Config = typeof config;

// Export the configuration object for import throughout the application
export default config;
