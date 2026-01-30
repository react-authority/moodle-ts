import { defineConfig } from "tsup";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// Dynamically discover generated Moodle version directories
function getGeneratedVersions(): string[] {
  const generatedDir = join(process.cwd(), "src/generated");
  if (!existsSync(generatedDir)) {
    return [];
  }
  return readdirSync(generatedDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

// Build entry points dynamically
function getEntryPoints(): Record<string, string> {
  const entries: Record<string, string> = {
    index: "src/index.ts",
  };

  for (const version of getGeneratedVersions()) {
    entries[`generated/${version}/index`] = `src/generated/${version}/index.ts`;
  }

  return entries;
}

export default defineConfig({
  entry: getEntryPoints(),
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: "es2022",
  outDir: "dist",
  // Ensure proper file extensions for ESM
  outExtension: () => ({
    js: ".js",
  }),
});
