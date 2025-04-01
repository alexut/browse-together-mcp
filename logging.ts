// logging.ts
import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  getLogger as getLogtapeLogger,
  type Logger,
} from "@logtape/logtape";
import config from "./config.ts";

const APP_CATEGORY = "tele-ts";

/**
 * Maps application log levels to LogTape log levels
 */
function mapLogLevel(level: string): "debug" | "info" | "error" | "warning" | "fatal" | undefined {
  const mapping: Record<string, "debug" | "info" | "error" | "warning" | "fatal"> = {
    "debug": "debug",
    "info": "info",
    "warn": "warning",
    "error": "error"
  };
  return mapping[level];
}

/**
 * Initialize the logging system.
 * Call once during application startup.
 */
export async function setupLogging(): Promise<void> {
  const isDevelopment = config.APP_ENV === "development";
  const isTest = config.APP_ENV === "test";
  
  try {
    await configure({
      sinks: {
        console: getConsoleSink({ 
          formatter: isDevelopment 
            ? ansiColorFormatter 
            : (record: unknown) => `${JSON.stringify(record)}\n`
        }),
      },
      loggers: [
        // Configure app loggers
        { 
          category: [APP_CATEGORY], 
          sinks: ["console"], 
          // Use error-only logging in test environment
          lowestLevel: isTest ? "error" : mapLogLevel(config.LOG_LEVEL) 
        },
        // Configure meta logger with higher log level to suppress info messages
        {
          category: ["logtape", "meta"],
          sinks: ["console"],
          // Only show warnings and more severe messages from the meta logger
          lowestLevel: "warning"
        }
      ],
    });
  } catch (error) {
    // Fallback to console logging if LogTape setup fails
    console.error("Failed to initialize logging system:", error);
  }
}

/**
 * Factory function for creating module-specific loggers.
 * @param module The module name to create a logger for
 * @returns A configured Logger instance for the specified module
 */
export function getLogger(module: string): Logger {
  return getLogtapeLogger([APP_CATEGORY, module]);
}
