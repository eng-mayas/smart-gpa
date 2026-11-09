import React, { useRef, useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { Field } from "../components/common";
import { ImportedRow, parseTranscriptText } from "../../core/importer";
import { newCourse } from "../../core/gpa";

declare global {
  interface Window { Tesseract?: { recognize: (img: File | string, lang: string, opts?: Record<string, unknown>) => Promise<{ data: { text: string } }> } }
}

async function loadTesseract(): Promise<NonNullable<Window["Tesseract"]>> {
  if (window.Tesseract) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("تعذّر تحميل محرك OCR"));
    document.head.appendChild(s);
  });
  return window.Tesseract!;
}

/** Upscale, grayscale and stretch contrast so OCR reads scanned tables better. */
async function preprocessImage(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(2.5, Math.max(1, 2000 / Math.max(img.width, img.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = d.data;
  let min = 255, max = 0;
  for (let i = 0; i < px.length; i += 4) { const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; px[i] = g; if (g < min) min = g; if (g > max) max = g; }
  const range = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) { const g = Math.max(0, Math.min(255, ((px[i] - min) / range) * 255 * 1.1 - 10)); px[i] = px[i + 1] = px[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/png");
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
}

export function ImportPage({ go }: { go: (p: string) => void }) {
  const { state, dispatch, scale, activePlan: plan } = useAcademic();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<"semester" | "past">("semester");
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = (t: string) => { const r = parseTranscriptText(t); setRows(r); if (r.length === 0) setError("لم يُتعرَّف على أي سطر. جرّب تنسيق: الرمز | الاسم | الساعات | العلامة"); else setError(""); };

  const onFile = async (f: File) => {
    setError("");
    if (state.extractionEndpoint.trim()) {
      setBusy("جارٍ الاستخراج بالذكاء الاصطناعي…");
      try {
        const res = await fetch(state.extractionEndpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: await fileToBase64(f), mime: f.type }) });
        if (!res.ok) throw new Error(`الخدمة ردّت بالرمز ${res.status}`);
        const data = (await res.json()) as { rows?: ImportedRow[]; text?: string };
        if (data.rows?.length) { setRows(data.rows.map((r) => ({ ...r, raw: r.raw ?? "", confidence: r.confidence ?? "high" }))); setBusy(null); return; }
        if (data.text) { setText(data.text); analyze(data.text); setBusy(null); return; }
        throw new Error("رد غير مفهوم من الخدمة");
      } catch (e) {
        setError(`فشل الاستخراج عبر الخدمة (${(e as Error).message}). سنجرّب OCR في المتصفح.`);
      }
    }
    if (!f.type.startsWith("image/")) { setBusy(null); setError("OCR في المتصفح يدعم الصور فقط (PNG/JPG). لملفات PDF صوّر الصفحة أو فعّل خدمة الاستخراج في الإعدادات."); return; }
    setBusy("جارٍ تحميل محرك القراءة الضوئية (أول مرة قد تستغرق دقيقة)…");
    try {
      const T = await loadTesseract();
      setBusy("جارٍ قراءة الصورة…");
      const prepared = await preprocessImage(f);
      const { data } = await T.recognize(prepared, "ara+eng");
      setText(data.text);
      analyze(data.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const update = (i: number, patch: Partial<ImportedRow>) => setRows(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows(rows.filter((_, j) => j !== i));

  const apply = () => {
    const good = rows.filter((r) => r.name);
    if (target === "semester") {
      const courses = good.map((r) => newCourse({
        id: r.code ? `imp-${r.code}` : undefined, name: r.name, credits: r.credits ?? 3,
        grade: r.mark !== undefined ? { kind: "mark", value: r.mark } : r.letter ? { kind: "letter", value: r.letter } : { kind: "none" },
      }));
      dispatch({ type: "courses", courses });
      go("semester");
    } else {
      const courses = good.map((r) => {
        const pc = plan?.courses.find((c) => c.code === r.code || c.name.toLowerCase() === r.name.toLowerCase() || c.nameAr === r.name);
        return newCourse({
          id: pc ? `plan-${pc.code}` : undefined, name: pc ? (pc.nameAr ?? pc.name) : r.name, credits: r.credits ?? pc?.credits ?? 3,
          grade: r.mark !== undefined ? { kind: "mark", value: r.mark } : r.letter ? { kind: "letter", value: r.letter } : { kind: "none" },
        });
      });
      const label = `${state.profile.academicYear || "فصل"} / ف${state.semesters.length + 1}`;
      dispatch({ type: "semesters", semesters: [...state.semesters, { id: Math.random().toString(36).slice(2, 8), label, kind: "detailed", courses }] });
      go("semesters");
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>استيراد كشف العلامات</h1>
          <p className="muted">الصق نص الكشف من بوابة الجامعة، أو ارفع صورة له. راجع الجدول ثم اعتمده كمقررات الفصل أو كمقررات منجزة في الخطة.</p>
        </div>
      </div>

      <div className="grid grid-2 mb">
        <div className="card">
          <h2>1) لصق نص</h2>
          <textarea className="input" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={"مثال:\n301201 | تحليل هندسي (1) | 3 | 72\nCalculus (2)\t3\t88\n601103 General Physics (1) 3 B+"} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} />
          <div className="row mt"><button className="btn primary" onClick={() => analyze(text)} disabled={!text.trim()}>تحليل النص</button></div>
        </div>
        <div className="card">
          <h2>2) صورة الكشف</h2>
          <p className="tiny">
            {state.extractionEndpoint ? "خدمة الاستخراج بالذكاء الاصطناعي مفعّلة (أدق مع الجداول العربية)." : "يعمل OCR داخل المتصفح (تجريبي، أدق مع النصوص الإنكليزية الواضحة). لدقة أعلى مع الجداول العربية فعّل خدمة الاستخراج من الإعدادات."}
          </p>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <div className="row">
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={!!busy}>📷 اختيار صورة / تصوير</button>
            <button className="btn" onClick={() => go("settings")}>إعدادات خدمة الاستخراج</button>
          </div>
          {busy && <div className="alert info mt">{busy}</div>}
          <p className="tiny mt">نصيحة: صوّر الكشف بإضاءة جيدة وبشكل مستقيم، وقصّ الصورة على الجدول فقط.</p>
        </div>
      </div>

      {error && <div className="alert warn mb">{error}</div>}

      {rows.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>3) مراجعة ({rows.length} سطر)</h2>
            <div className="row">
              <Field label="اعتماد كـ">
                <select className="input" value={target} onChange={(e) => setTarget(e.target.value as "semester" | "plan")}>
                  <option value="semester">مقررات الفصل الحالي</option>
                  <option value="past">فصل مكتمل سابق (يُضاف إلى «فصولي»)</option>
                </select>
              </Field>
              <button className="btn primary" onClick={apply}>اعتماد</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>الرمز</th><th>المقرر</th><th className="c">ساعات</th><th className="c">العلامة</th><th className="c">حرف</th><th className="c">الثقة</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className="input num" style={{ width: 100 }} value={r.code ?? ""} onChange={(e) => update(i, { code: e.target.value || undefined })} /></td>
                    <td><input className="input" value={r.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
                    <td className="c"><input className="input num" style={{ width: 70 }} type="number" step="0.5" value={r.credits ?? ""} onChange={(e) => update(i, { credits: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
                    <td className="c"><input className="input num" style={{ width: 80 }} type="number" value={r.mark ?? ""} onChange={(e) => update(i, { mark: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
                    <td className="c">
                      <select className="input" value={r.letter ?? ""} onChange={(e) => update(i, { letter: e.target.value || undefined })}>
                        <option value="">—</option>
                        {scale.bands.map((b) => <option key={b.letter} value={b.letter}>{b.letter}</option>)}
                      </select>
                    </td>
                    <td className="c"><span className={`badge ${r.confidence === "high" ? "green" : r.confidence === "medium" ? "yellow" : "red"}`}>{r.confidence === "high" ? "عالية" : r.confidence === "medium" ? "متوسطة" : "منخفضة"}</span></td>
                    <td><button className="btn ghost sm danger" onClick={() => remove(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
