// cli.ts - Re-export unified configuration from config.ts
import config, { logActiveConfiguration, type Config } from "./config.ts";

// Log active configuration for backward compatibility
logActiveConfiguration();

// Re-export the complete configuration type and object
export type { Config };
export default config;
