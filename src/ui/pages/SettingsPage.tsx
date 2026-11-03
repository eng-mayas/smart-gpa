import React, { useRef } from "react";
import { useStore } from "../../state/store";
import { Field, NumberInput } from "../components/common";

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const p = state.profile;
  const setP = (patch: Partial<typeof p>) => dispatch({ type: "profile", patch });
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smart-gpa-profile.json";
    a.click();
  };
  const importJson = (f: File) => {
    f.text().then((t) => {
      try {
        const parsed = JSON.parse(t);
        if (parsed && parsed.version === 1) dispatch({ type: "set", patch: parsed });
        else alert("ملف غير صالح");
      } catch {
        alert("تعذّر قراءة الملف");
      }
    });
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>الإعدادات والملف الأكاديمي</h1>
          <p className="muted">تُحفظ البيانات محلياً في متصفحك فقط (وضع الضيف). يمكن تصديرها واستيرادها كملف.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>الملف الأكاديمي</h2>
          <div className="grid grid-2">
            <Field label="الاسم (اختياري)"><input className="input" value={p.name} onChange={(e) => setP({ name: e.target.value })} /></Field>
            <Field label="الجامعة"><input className="input" value={p.university} onChange={(e) => setP({ university: e.target.value })} /></Field>
            <Field label="الكلية"><input className="input" value={p.faculty} onChange={(e) => setP({ faculty: e.target.value })} /></Field>
            <Field label="التخصص"><input className="input" value={p.major} onChange={(e) => setP({ major: e.target.value })} /></Field>
            <Field label="النظام الأكاديمي"><input className="input" value={p.academicSystem} onChange={(e) => setP({ academicSystem: e.target.value })} /></Field>
            <Field label="العام الدراسي"><input className="input" value={p.academicYear} onChange={(e) => setP({ academicYear: e.target.value })} /></Field>
            <Field label="إجمالي ساعات الخطة"><NumberInput value={p.planCredits} min={0} max={400} onChange={(v) => setP({ planCredits: v === "" ? 0 : v })} /></Field>
            <Field label="الساعات المنجزة"><NumberInput value={p.completedCredits} min={0} max={400} onChange={(v) => setP({ completedCredits: v === "" ? 0 : v })} /></Field>
            <Field label="الساعات المحسوبة في المعدل"><NumberInput value={p.previousGpaHours} min={0} max={400} onChange={(v) => setP({ previousGpaHours: v === "" ? 0 : v })} /></Field>
            <Field label="المعدل التراكمي السابق"><NumberInput value={p.previousCgpa} min={0} max={4} step={0.01} onChange={(v) => setP({ previousCgpa: v === "" ? 0 : v })} /></Field>
            <Field label="الإنذارات السابقة"><NumberInput value={p.previousWarnings} min={0} max={5} onChange={(v) => setP({ previousWarnings: v === "" ? 0 : v })} /></Field>
            <Field label="المقررات المتبقية"><NumberInput value={p.remainingCourses} min={0} max={100} onChange={(v) => setP({ remainingCourses: v === "" ? 0 : v })} /></Field>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>المظهر واللغة</h2>
            <div className="row">
              <div className="segmented">
                <button className={state.theme === "light" ? "on" : ""} onClick={() => dispatch({ type: "set", patch: { theme: "light" } })}>☀ فاتح</button>
                <button className={state.theme === "dark" ? "on" : ""} onClick={() => dispatch({ type: "set", patch: { theme: "dark" } })}>🌙 داكن</button>
              </div>
              <div className="segmented">
                <button className={state.lang === "ar" ? "on" : ""} onClick={() => dispatch({ type: "set", patch: { lang: "ar" } })}>العربية</button>
                <button className={state.lang === "en" ? "on" : ""} onClick={() => dispatch({ type: "set", patch: { lang: "en" } })}>English</button>
              </div>
            </div>
            <p className="tiny mt">الترجمة الإنكليزية تشمل القائمة والعناوين الرئيسية حالياً.</p>
          </div>
          <div className="card row" style={{ gap: "1rem" }}>
            <img src="./atmata-logo.png" alt="Atmata Group" style={{ width: 96, height: 96, background: "#fff", borderRadius: 16, padding: 6 }} />
            <div>
              <h2>حول التطبيق</h2>
              <p>Smart GPA — الإصدار 1.0</p>
              <p>تم تطوير التطبيق بواسطة <b style={{ color: "var(--primary)" }}>Atmata Group</b> (أتمتة غروب)</p>
              <p className="tiny" style={{ color: "var(--teal)", fontWeight: 600 }}>Automating Tomorrow</p>
            </div>
          </div>
          <div className="card">
            <h2>خدمة الاستخراج من الصور (اختياري)</h2>
            <p className="tiny">لقراءة صور كشوف العلامات بدقة عالية عبر الذكاء الاصطناعي، انشر الخدمة الموجودة في مجلد <span className="kbd">worker/</span> على Cloudflare Workers والصق رابطها هنا. بدونها يُستخدم OCR داخل المتصفح.</p>
            <Field label="رابط الخدمة"><input className="input" dir="ltr" placeholder="https://smart-gpa-extract.<account>.workers.dev" value={state.extractionEndpoint} onChange={(e) => dispatch({ type: "set", patch: { extractionEndpoint: e.target.value.trim() } })} /></Field>
          </div>
          <div className="card">
            <h2>البيانات</h2>
            <div className="row">
              <button className="btn" onClick={exportJson}>⬇ تصدير JSON</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>⬆ استيراد JSON</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
              <button className="btn" onClick={() => dispatch({ type: "loadSample" })}>تحميل بيانات تجريبية</button>
              <button className="btn danger" onClick={() => confirm("سيتم مسح كل البيانات المحلية. متابعة؟") && dispatch({ type: "reset" })}>مسح الكل</button>
            </div>
            <p className="tiny mt">طبقة التخزين معزولة في <span className="kbd">src/state/store.tsx</span> ويمكن استبدالها بـ Supabase لحفظ الملفات سحابياً.</p>
          </div>
        </div>
      </div>
    </>
  );
}
