import { build, context } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outDir = "public/v1";

await mkdir(outDir, { recursive: true });
await copyFile("src/popup.css", `${outDir}/popup.css`);

const opts = {
  entryPoints: ["src/index.ts"],
  outfile: `${outDir}/popup.js`,
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: !watch,
  sourcemap: watch,
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("watching…");
} else {
  await build(opts);
  console.log("built", outDir);
}
