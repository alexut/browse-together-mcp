// cli.ts - Command-line argument processing for the browser proxy
import { parseArgs } from "std/cli/parse-args";
import config from "./config.ts";

// Parse command line flags
export function parseCommandLineArgs() {
  const flags = parseArgs(Deno.args, {
    string: ["profile-dir", "log-level", "port"],  // Treat port as string initially
    boolean: ["headless"],                        // Boolean flags
    default: {                                    // Default values
      "log-level": config.LOG_LEVEL,
      "headless": config.HEADLESS,
      "port": String(config.PORT)
    },
    negatable: ["headless"]                       // Allow --no-headless format
  });

  // Create a merged configuration with command-line flags taking precedence
  const runtimeConfig = {
    ...config,
    PORT: flags.port ? Number.parseInt(flags.port, 10) : config.PORT,
    HEADLESS: flags.headless ?? config.HEADLESS,
    LOG_LEVEL: flags["log-level"] ?? config.LOG_LEVEL,
    PROFILE_DIR: flags["profile-dir"] ?? config.PROFILE_DIR,
  };

  // Log the active configuration
  console.log("Active configuration:");
  console.log(`- PORT: ${runtimeConfig.PORT}`);
  console.log(`- HEADLESS: ${runtimeConfig.HEADLESS}`);
  console.log(`- LOG_LEVEL: ${runtimeConfig.LOG_LEVEL}`);
  console.log(`- PROFILE_DIR: ${runtimeConfig.PROFILE_DIR}`);
  
  return runtimeConfig;
}

// Export the parsed and merged configuration
export default parseCommandLineArgs();
