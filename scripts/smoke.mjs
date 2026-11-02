// Headless smoke test: serve dist/, visit every page, capture console errors and screenshots.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) { res.statusCode = 404; return res.end("nf"); }
  res.setHeader("content-type", types[extname(p)] ?? "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4173, r));

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
// block external fonts to keep offline
await page.route("**/fonts.googleapis.com/**", (r) => r.abort());

const routes = ["dashboard", "semester", "cumulative", "predictor", "exhaustion", "warnings", "history", "regulations", "settings"];
for (const r of routes) {
  await page.goto(`http://localhost:4173/#${r}`);
  await page.waitForTimeout(400);
  const h1 = await page.locator("h1").first().textContent();
  console.log(`${r}: ${h1?.trim()}`);
  await page.screenshot({ path: `shots/${r}.png`, fullPage: true });
}
// interaction: change a mark on semester page and verify GPA updates
await page.goto("http://localhost:4173/#semester");
await page.waitForTimeout(300);
const before = await page.locator(".stat .value").first().textContent();
const firstMark = page.locator('input[aria-label="العلامة المئوية"]').first();
await firstMark.fill("99");
await page.waitForTimeout(200);
const after = await page.locator(".stat .value").first().textContent();
console.log("GPA before/after editing first mark:", before, "→", after);
// dark theme screenshot
await page.goto("http://localhost:4173/#dashboard");
await page.locator("aside .btn").first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/dashboard-dark.png", fullPage: true });
// mobile
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.route("**/fonts.googleapis.com/**", (r) => r.abort());
await mobile.goto("http://localhost:4173/#exhaustion");
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: "shots/mobile-exhaustion.png", fullPage: false });

await browser.close();
server.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "No runtime errors.");
process.exit(errors.length ? 1 : 0);
