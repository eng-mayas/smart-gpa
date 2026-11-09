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
// skip the first-run wizard so every page renders its normal content
// load the sample data set so every page renders content
await page.goto("http://localhost:4173/#settings"); await page.waitForTimeout(300);
await page.getByText("تحميل بيانات تجريبية").click(); await page.waitForTimeout(200);

const routes = ["dashboard", "semesters", "plan", "mentor", "progress", "semester", "cumulative", "predictor", "exhaustion", "warnings", "import", "regulations", "advisor", "settings"];
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
// plan flow: choose built-in plan, mark a course done, check suggestion renders
await page.goto("http://localhost:4173/#plan");
await page.waitForTimeout(300);
await page.locator("select.input").first().selectOption({ index: 1 });
await page.waitForTimeout(300);
const planText = await page.locator("main").textContent();
console.log("plan loaded:", planText.includes("اقتراح تسجيل") && planText.includes("158"));
await page.locator("tbody select.input").first().selectOption("done");
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/plan.png", fullPage: true });
// progress page: enter a quiz score and check needed-final table
await page.goto("http://localhost:4173/#progress");
await page.waitForTimeout(300);
const scoreInput = page.locator('input[placeholder="—"]').first();
await scoreInput.fill("12");
await page.waitForTimeout(200);
const prog = await page.locator("main").textContent();
console.log("progress needed table:", prog.includes("ماذا أحتاج") && prog.includes("%"));
await page.screenshot({ path: "shots/progress.png", fullPage: true });
// import: paste text
await page.goto("http://localhost:4173/#import");
await page.waitForTimeout(300);
await page.locator("textarea").first().fill("301201 | تحليل هندسي (1) | 3 | 72\nCalculus (2)\t3\t88\tB+");
await page.locator("button.btn.primary").first().click();
await page.waitForTimeout(200);
console.log("import rows:", await page.locator("tbody tr").count());
// semesters: finish current semester → appears as completed; derived CGPA updates
await page.goto("http://localhost:4173/#semesters"); await page.waitForTimeout(300);
const semBefore = await page.locator(".stat .value").nth(1).textContent();
// remove the course without a grade so "finish" is enabled
await page.locator('tbody tr', { hasText: "لا توجد علامة" }).first().locator('button[aria-label="حذف"]').click();
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: /انتهى الفصل/ }).click(); await page.waitForTimeout(300);
const semAfter = await page.locator(".stat .value").nth(1).textContent();
console.log("semesters completed before/after:", semBefore, "→", semAfter);
await page.screenshot({ path: "shots/semesters.png", fullPage: true });
// advisor: sample data
await page.goto("http://localhost:4173/#advisor");
await page.waitForTimeout(300);
await page.getByText("بيانات تجريبية").click();
await page.waitForTimeout(300);
console.log("advisor rows:", await page.locator("tbody tr").count());
await page.screenshot({ path: "shots/advisor.png", fullPage: true });
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
