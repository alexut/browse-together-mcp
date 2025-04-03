// scripts/generate-tokens.ts
import { parseArgs } from "@std/cli/parse-args";

/**
 * Generates a cryptographically secure random token of the specified length
 * @param length Number of bytes for the token (default 48)
 * @returns A Base64 encoded string representing the token
 */
function generateSecureToken(length = 48): string {
  // Generate random bytes using crypto
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  
  // Convert to Base64 and make URL-safe
  const base64 = btoa(String.fromCharCode(...randomBytes));
  return base64
    .replace(/\+/g, '-') // Replace '+' with '-' (URL-safe)
    .replace(/\//g, '_') // Replace '/' with '_' (URL-safe)
    .replace(/=/g, '');  // Remove padding '=' (not needed)
}

/**
 * Display usage information
 */
function showHelp(): void {
  console.log("\nBROWSE TOGETHER MCP - SECURITY TOKEN GENERATOR\n");
  console.log("USAGE:");
  console.log("  deno run -A scripts/generate-tokens.ts [OPTIONS]\n");
  console.log("OPTIONS:");
  console.log("  -l, --length <NUMBER>  Set token length in bytes (16-128, default: 48)");
  console.log("  -h, --help             Show this help message\n");
  console.log("EXAMPLES:");
  console.log("  deno run -A scripts/generate-tokens.ts");
  console.log("  deno run -A scripts/generate-tokens.ts --length 64\n");
}

/**
 * Main function to generate and display tokens
 */
function main(): void {
  // Parse command line arguments using std/cli
  const flags = parseArgs(Deno.args, {
    string: ["length"],
    boolean: ["help"],
    alias: {
      l: "length",
      h: "help"
    },
    default: {
      length: "48"
    }
  });
  
  // Show help if requested
  if (flags.help) {
    showHelp();
    return;
  }
  
  // Parse and validate token length
  const lengthArg = Number(flags.length);
  let tokenLength = 48; // Default 48 bytes (384 bits)
  
  if (!Number.isNaN(lengthArg)) {
    if (lengthArg >= 16 && lengthArg <= 128) {
      tokenLength = lengthArg;
    } else {
      console.error("Error: Token length must be a number between 16 and 128");
      Deno.exit(1);
    }
  } else {
    console.error("Error: Invalid token length value");
    showHelp();
    Deno.exit(1);
  }
  
  // Generate token
  const token = generateSecureToken(tokenLength);
  
  // Output information
  console.log("\nBROWSE TOGETHER MCP - SECURITY TOKEN GENERATOR\n");
  console.log(`Generated token (${tokenLength * 8} bits):`);
  console.log(`\n${token}\n`);
  console.log("Instructions:");
  console.log("1. Copy this token and keep it secure");
  console.log(`2. Set as an environment variable:\n   export BROWSER_API_TOKEN='${token}'`);
  console.log("   - OR -");
  console.log(`3. Provide as a CLI argument:\n   --browser-api-token='${token}'`);
  console.log("\nThis token will be required to start and access both the Browser Service and MCP Server\n");
}

// Run the main function
if (import.meta.main) {
  main();
}
