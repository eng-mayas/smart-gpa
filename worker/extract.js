/**
 * Smart GPA — transcript extraction service (Cloudflare Worker).
 * Receives { image: <base64>, mime } and returns { rows: [{code,name,credits,mark,letter,confidence}] }
 * using the Claude API. The API key never reaches the browser.
 *
 * Deploy:
 *   npm i -g wrangler && wrangler login
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler deploy
 * Then paste the worker URL into Smart GPA → الإعدادات → خدمة الاستخراج.
 */
const MAX_BODY = 8 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_ORIGINS = ["https://smart-gpa.pages.dev", "https://eng-mayas.github.io", "http://localhost:4173"];

const PROMPT = `You are reading a university transcript or grade report (Arabic or English).
Extract every course row as JSON: {"rows":[{"code":"","name":"","credits":3,"mark":72,"letter":"C+"}]}.
- code: course code if present (digits/letters), else omit.
- name: course name exactly as written (Arabic or English).
- credits: credit hours as a number if present.
- mark: numeric mark 0–100 if present; letter: letter grade if present (A+, A, A-, B+ ... F).
- Ignore totals, GPA lines, headers, student names and IDs. Return ONLY the JSON object.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers: cors });
    // Only the app's own origins may call this service (prevents others from spending your API quota).
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response("forbidden origin", { status: 403 });
    const len = Number(request.headers.get("content-length") || 0);
    if (len > MAX_BODY) return new Response("image too large (max 8 MB)", { status: 413, headers: cors });
    if (!/^application\/json/.test(request.headers.get("content-type") || "")) return new Response("json only", { status: 415, headers: cors });
    let body;
    try { body = await request.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }
    if (!body.image) return new Response("missing image", { status: 400, headers: cors });
    const mime = ALLOWED_MIME.includes(body.mime) ? body.mime : "image/jpeg";
    if (typeof body.image !== "string" || body.image.length > MAX_BODY * 1.4) return new Response("bad image", { status: 400, headers: cors });
    const content = mime === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: mime, data: body.image } }, { type: "text", text: PROMPT }]
      : [{ type: "image", source: { type: "base64", media_type: mime, data: body.image } }, { type: "text", text: PROMPT }];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.MODEL || "claude-sonnet-4-5", max_tokens: 4000, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) return new Response("extraction failed", { status: 502, headers: cors }); // never leak upstream details
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    let rows = [];
    try { rows = JSON.parse(match ? match[0] : text).rows || []; } catch { /* fall through */ }
    rows = rows.map((r) => ({ ...r, raw: "", confidence: r.name && (r.mark !== undefined || r.letter) ? "high" : "medium" }));
    return new Response(JSON.stringify({ rows }), { headers: { ...cors, "content-type": "application/json" } });
  },
};
