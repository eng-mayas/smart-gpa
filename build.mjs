// Build script: bundles the app with esbuild into dist/ (no Vite needed).
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/assets", { recursive: true });
cpSync("index.html", "dist/index.html");
cpSync("public", "dist", { recursive: true });
// Stamp the service worker so each build invalidates the previous cache.
const build = Date.now().toString(36);
writeFileSync("dist/sw.js", readFileSync("public/sw.js", "utf8").replace("__BUILD__", build));

const opts = {
  entryPoints: { app: "src/main.tsx" },
  bundle: true,
  format: "esm",
  outdir: "dist/assets",
  minify: !watch,
  sourcemap: watch,
  target: ["es2020"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  logLevel: "info",
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: "dist" });
  console.log(`Dev server: http://${hosts[0]}:${port}`);
} else {
  await build(opts);
}
