import { parse } from "std/flags";
import { walk } from "std/fs";
import { extname } from "std/path";

async function processTypeScriptFiles(paths: string[]) {
  for (const path of paths) {
    try {
      for await (const entry of walk(path, {
        includeDirs: false,
        exts: [".ts"],
        skip: [/node_modules/],
      })) {
        if (extname(entry.path) === ".ts") {
          console.log(`Processing: ${entry.path}`);
          // Add your TypeScript file processing logic here
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing ${path}: ${errorMessage}`);
    }
  }
}

if (import.meta.main) {
  const args = parse(Deno.args, {
    string: ["_"],
    default: { "_": [] },
  });

  if (args._.length === 0) {
    console.error("Usage: deno run --allow-read cli.ts <file-or-directory-paths...>");
    Deno.exit(1);
  }

  await processTypeScriptFiles(args._.map(String));
}
