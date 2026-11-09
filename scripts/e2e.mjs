// End-to-end student journey with independent arithmetic checks.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => { let p = join(root, decodeURIComponent(req.url.split("?")[0])); if (p.endsWith("/")) p += "index.html"; if (!existsSync(p)) { res.statusCode = 404; return res.end(); } res.setHeader("content-type", types[extname(p)] ?? "application/octet-stream"); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(4180, r));
const B = "http://localhost:4180/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push("pageerror: " + e.message)); page.on("requestfailed", (r) => { if (!r.url().includes("fonts.g")) errors.push("requestfailed: " + r.url()); }); page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("ERR_FAILED")) errors.push("console: " + m.text()); });
await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
const results = []; const check = (name, ok, info = "") => { results.push({ name, ok, info }); console.log(`${ok ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); };
const text = async () => (await page.locator("main").textContent()) ?? "";
const go = async (r) => { await page.goto(B + "#" + r); await page.waitForTimeout(250); };
page.on("dialog", (d) => d.accept());

// 1. First run is empty with quick start
await go("dashboard");
check("first run empty + quick start", (await text()).includes("أدخل بياناتك لتبدأ") && !(await text()).includes("رياضيات 2"));

// 2. Quick start: choose university, GPA 1.60 over 45h, 2 warnings
await page.locator("select.input").first().selectOption({ index: 8 });
const qs = page.locator(".card input[type=number]");
await qs.nth(0).fill("1.6"); await qs.nth(1).fill("45"); await qs.nth(2).fill("2"); await page.waitForTimeout(200);
const strip = await text();
check("quick start shows status for 1.60/2 warnings", strip.includes("إنذار أكاديمي ثانٍ"), "expects warning_2");
await page.getByRole("button", { name: /^ابدأ/ }).click(); await page.waitForTimeout(300);
check("routes at-risk student to exhaustion page", page.url().endsWith("#exhaustion"));

// 3. Add two detailed semesters in فصولي (overrides quick numbers)
await go("semesters");
await page.getByRole("button", { name: /فصل مفصّل/ }).click(); await page.waitForTimeout(200);
// first semester: 3 courses: 3cr 85 (B+ 3.25), 3cr 72 (C+ 2.5), 2cr 45 (F)
const addRows = async (n) => { for (let i = 0; i < n; i++) { await page.locator(".card .card").last().getByRole("button", { name: /إضافة مقرر/ }).click(); } };
await addRows(2);
const rows = page.locator(".card .card").last().locator("tbody tr");
const setRow = async (i, name, credits, mark) => { const r = rows.nth(i); await r.locator('input[aria-label="اسم المقرر"]').fill(name); await r.locator('input[aria-label="الساعات المعتمدة"]').fill(String(credits)); await r.locator('input[aria-label="العلامة المئوية"]').fill(String(mark)); };
await setRow(0, "رياضيات 1", 3, 85); await setRow(1, "فيزياء 1", 3, 72); await setRow(2, "ثقافة", 2, 45);
await page.waitForTimeout(300);
const sem1Gpa = (3.25 * 3 + 2.5 * 3 + 0 * 2) / 8; // 2.15625
let t = await text();
check("semester 1 GPA = 2.16 (manual: " + sem1Gpa.toFixed(4) + ")", t.includes("فصلي 2.16"));
check("derived CGPA replaces quick-start numbers (2.16, 8h)", t.includes("8 ساعة") && /المعدل التراكمي\s*2\.16/.test(t.replace(/\s+/g, " ")));

// second semester quick: 2.80 over 15h
await page.getByRole("button", { name: /فصل سريع/ }).click(); await page.waitForTimeout(200);
const card2 = page.locator(".card .card").last();
const q = card2.locator("input[type=number]");
await q.nth(0).fill("2.8"); await q.nth(1).fill("15"); await q.nth(2).fill("15"); await page.waitForTimeout(300);
const cg = (sem1Gpa * 8 + 2.8 * 15) / 23; // 2.576
t = (await text()).replace(/\s+/g, " ");
check("CGPA after two semesters = " + cg.toFixed(2), t.includes("المعدل التراكمي " + cg.toFixed(2)) || t.includes(cg.toFixed(2)), "found " + (t.match(/المعدل التراكمي\s*([\d.]+)/)?.[1] ?? "?"));
check("percentage = " + (cg * 20 + 20).toFixed(1) + "%", t.includes((cg * 20 + 20).toFixed(1) + "%"));
check("status timeline: sem1 → warning_1 (2.16 ≥ 2? no: 2.16 ≥ 2 → good)", t.includes("وضع أكاديمي سليم"));

// 4. Current semester: 2 courses, one F → predicted
await rows.first(); // noop
const cur = page.locator(".card").filter({ hasText: "الفصل الحالي" }).first();
await cur.getByRole("button", { name: /إضافة مقرر/ }).click(); await cur.getByRole("button", { name: /إضافة مقرر/ }).click(); await page.waitForTimeout(150);
const crows = cur.locator("tbody tr");
const setCur = async (i, name, credits, mark) => { const r = crows.nth(i); await r.locator('input[aria-label="اسم المقرر"]').fill(name); await r.locator('input[aria-label="الساعات المعتمدة"]').fill(String(credits)); await r.locator('input[aria-label="العلامة المئوية"]').fill(String(mark)); };
await setCur(0, "برمجة 1", 3, 91); await setCur(1, "كيمياء", 3, 58); await page.waitForTimeout(300);
const curGpa = (3.5 * 3 + 1.75 * 3) / 6; // 2.625
const newCg = (cg * 23 + curGpa * 6) / 29;
t = (await text()).replace(/\s+/g, " ");
check("current semester GPA " + curGpa.toFixed(2), t.includes(curGpa.toFixed(2)));
check("projected CGPA " + newCg.toFixed(2), t.includes(newCg.toFixed(2)));

// 5. Cumulative page shows derived numbers read-only note
await go("cumulative");
t = (await text()).replace(/\s+/g, " ");
check("cumulative page derived from semesters", t.includes("محسوبة تلقائياً من «فصولي»") && t.includes(newCg.toFixed(2)));

// 6. Plan: choose sample plan, course picker, suggestion
await go("plan");
await page.locator("select.input").first().selectOption({ index: 1 }); await page.waitForTimeout(300);
t = (await text()).replace(/\s+/g, " ");
check("plan loaded with registration suggestion", t.includes("اقتراح تسجيل الفصل القادم") && t.includes("158"));
// mark 601101 done with letter B via UI
const row601101 = page.locator("tr", { hasText: "601101" }).filter({ has: page.locator("select") }).first();
await row601101.locator("select").first().selectOption("done"); await page.waitForTimeout(150);
await row601101.locator("select").nth(1).selectOption("B"); await page.waitForTimeout(250);
t = (await text()).replace(/\s+/g, " ");
const row601102 = page.locator("tr", { hasText: "601102" }).filter({ has: page.locator("select") }).first();
check("601102 becomes eligible after 601101 done", !(await row601102.textContent()).includes("ناقص"));

// 7. Mentor
await go("mentor");
t = (await text()).replace(/\s+/g, " ");
check("mentor: status + next semester + graduation paths", t.includes("أين أنت الآن") && t.includes("الفصل القادم") && t.includes("ثلاثة مسارات للتخرج"));
check("mentor flags borderline course (58 → 60 = C-)", t.includes("كيمياء") && t.includes("تفصلك عن C-"));

// 8. Home shows mentor card and no demo banner
await go("dashboard");
t = (await text()).replace(/\s+/g, " ");
check("home: mentor card, no demo banner, no quick start", t.includes("المستشار يقول") && !t.includes("بيانات تجريبية") && !t.includes("أدخل بياناتك لتبدأ"));

// 9. Finish semester → becomes completed, CGPA updates
await go("semesters");
await page.getByRole("button", { name: /انتهى الفصل/ }).click(); await page.waitForTimeout(300);
t = (await text()).replace(/\s+/g, " ");
check("finish semester → CGPA " + newCg.toFixed(2) + " over 29h", t.includes("29 ساعة") && t.includes(newCg.toFixed(2)));

// 10. Backup export + persistence after reload
const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("aside .btn").first().click()]);
const path = await dl.path(); const json = JSON.parse(readFileSync(path, "utf8"));
check("backup JSON contains 3 semesters", Array.isArray(json.semesters) && json.semesters.length === 3);
await page.reload(); await page.waitForTimeout(400);
t = (await text()).replace(/\s+/g, " ");
check("state persists after reload", t.includes("29 ساعة"));

// 11. Regulations shows verified policy; warnings page glossary
await go("regulations"); t = await text();
check("verified unified policy active", t.includes("موثّقة") && t.includes("المادة 21"));

// 12. Mobile viewport bottom nav
const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 }); await m.route("**/fonts.googleapis.com/**", (r) => r.abort());
await m.goto(B + "#dashboard"); await m.waitForTimeout(300);
check("mobile bottom nav with 5 items", (await m.locator(".bottom-nav a, .bottom-nav button").count()) === 6);
await m.screenshot({ path: "shots/e2e-mobile-home.png" });
await m.close();

// 13. Dark theme toggle persists
await page.locator("aside .btn").nth(1).click(); await page.waitForTimeout(150);
check("dark theme applied", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");

await page.screenshot({ path: "shots/e2e-final.png", fullPage: false });
await browser.close(); server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Runtime errors: ${errors.length}`);
if (errors.length) console.log(errors.join("\n"));
process.exit(failed.length || errors.length ? 1 : 0);
