import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { Field, NumberInput, StatusBadge } from "./common";
import { fmtGpa, gpaToPct } from "../../core/format";
import { stateFromProfile } from "../../state/useAcademic";
import { describeState, nextThresholds } from "../../core/rules";
import { requiredSemesterGpa } from "../../core/predictor";

/**
 * Three-step first-run flow: who are you → where do you stand → what it means.
 * Shown while demo data is untouched; ends demo mode when the student saves.
 */
export function Onboarding({ onDone, go }: { onDone: () => void; go: (p: string) => void }) {
  const { state, dispatch, scale, policy } = useAcademic();
  const [step, setStep] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const [cgpa, setCgpa] = useState<number | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [warnings, setWarnings] = useState<number | "">(0);
  const [registered, setRegistered] = useState<number | "">(15);
  const [university, setUniversity] = useState(state.profile.university);
  const [major, setMajor] = useState("");

  const c = cgpa === "" ? 0 : cgpa, h = hours === "" ? 0 : hours, w = warnings === "" ? 0 : warnings, r = registered === "" ? 15 : registered;
  const st = stateFromProfile(isNew ? 0 : w, isNew ? 0 : h, isNew ? 0 : Math.max(2, Math.round(h / 15)));
  const th = nextThresholds(st, policy, 0);
  const reqSafe = requiredSemesterGpa({ previousCgpa: c, previousGpaHours: h, semesterHours: r, targetCgpa: th.safe });
  const reqSurvive = th.survive === null ? null : requiredSemesterGpa({ previousCgpa: c, previousGpaHours: h, semesterHours: r, targetCgpa: th.survive });
  const safe = isNew || c >= policy.goodStandingMin;

  const save = () => {
    dispatch({ type: "reset" });
    dispatch({ type: "profile", patch: { university, major, previousCgpa: isNew ? 0 : c, previousGpaHours: isNew ? 0 : h, completedCredits: isNew ? 0 : h, previousWarnings: isNew ? 0 : w } });
    onDone();
    go(safe ? "semester" : "exhaustion");
  };

  return (
    <div className="card mb" style={{ borderTop: "5px solid var(--primary)" }}>
      <div className="row between mb">
        <h2 style={{ margin: 0 }}>ابدأ في دقيقة واحدة</h2>
        <div className="row">
          {[0, 1, 2].map((i) => <span key={i} className={`badge ${i === step ? "blue" : i < step ? "green" : "gray"}`}>{i + 1}</span>)}
          <button className="btn ghost sm" onClick={onDone}>تخطّي، أريد استكشاف البيانات التجريبية</button>
        </div>
      </div>

      {step === 0 && (
        <div className="stack">
          <p className="muted">أين أنت في دراستك؟</p>
          <div className="row">
            <button className={`btn ${!isNew ? "primary" : ""}`} onClick={() => setIsNew(false)}>أنهيت فصلاً أو أكثر</button>
            <button className={`btn ${isNew ? "primary" : ""}`} onClick={() => setIsNew(true)}>طالب جديد (الفصل الأول)</button>
          </div>
          <div className="grid grid-2">
            <Field label="الجامعة"><input className="input" value={university} onChange={(e) => setUniversity(e.target.value)} /></Field>
            <Field label="التخصص"><input className="input" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="مثال: هندسة الحاسوب" /></Field>
          </div>
          <div className="row"><button className="btn primary" onClick={() => setStep(1)}>التالي ←</button></div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          {isNew ? (
            <p className="muted">ممتاز — لا يوجد معدل سابق. سنبدأ من مقررات فصلك الأول. كم ساعة سجّلت؟</p>
          ) : (
            <p className="muted">اكتب الأرقام كما تظهر في كشف علاماتك (من بوابة الجامعة).</p>
          )}
          <div className="grid grid-4">
            {!isNew && <Field label="معدلك التراكمي الحالي (من 4)"><NumberInput value={cgpa} min={0} max={scale.maxPoints} step={0.01} onChange={setCgpa} placeholder="مثال 1.85" /></Field>}
            {!isNew && <Field label="الساعات المحسوبة في المعدل"><NumberInput value={hours} min={0} max={300} onChange={setHours} placeholder="مثال 60" /></Field>}
            {!isNew && <Field label="عدد الإنذارات التي تلقيتها"><NumberInput value={warnings} min={0} max={3} onChange={setWarnings} /></Field>}
            <Field label="الساعات المسجّلة هذا الفصل"><NumberInput value={registered} min={1} max={24} onChange={setRegistered} /></Field>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep(0)}>→ رجوع</button>
            <button className="btn primary" onClick={() => setStep(2)} disabled={!isNew && (cgpa === "" || hours === "")}>اعرض وضعي ←</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          {isNew ? (
            <div className="alert ok"><div>✅ لا يُحتسب معدل تراكمي قبل نهاية الفصل {policy.cgpaStartsAtSemester} وفق السياسة. هدفك الآن: معدل فصلي ≥ {fmtGpa(policy.goodStandingMin)} لتبدأ بوضع سليم.</div></div>
          ) : (
            <>
              <div className="row">
                <StatusBadge status={st.status} lg />
                <span className="badge gray">المعدل {fmtGpa(c)} = {gpaToPct(c, scale)}</span>
              </div>
              <p>{describeState(st, policy)}</p>
              <div className={`alert ${safe ? "ok" : "warn"}`}>
                <div>
                  {safe ? (
                    <>✅ أنت في وضع سليم. للبقاء فيه يكفي معدل فصلي ≥ <b className="num">{reqSafe === null ? "—" : reqSafe <= 0 ? fmtGpa(policy.goodStandingMin) : fmtGpa(reqSafe)}</b> على {r} ساعة.</>
                  ) : (
                    <>
                      ⚠ تحتاج هذا الفصل إلى معدل فصلي <b className="num">{reqSafe === null ? "—" : reqSafe > scale.maxPoints ? "أعلى من الممكن" : fmtGpa(reqSafe)}</b> للعودة إلى الوضع السليم
                      {reqSurvive !== null && <>، و<b className="num">{reqSurvive <= 0 ? "أي معدل" : reqSurvive > scale.maxPoints ? "غير ممكن" : fmtGpa(reqSurvive)}</b> على الأقل لتجنّب الفصل</>}.
                      {reqSafe !== null && reqSafe > scale.maxPoints && " العودة تحتاج أكثر من فصل — صفحة «كيف أتجنب الاستنفاذ» تضع لك الخطة."}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          <p className="tiny">* وفق سياسة {policy.universityNameAr} ({policy.verification === "verified" ? "موثّقة" : "مسودة — تحقق من لائحة جامعتك"}).</p>
          <div className="row">
            <button className="btn" onClick={() => setStep(1)}>→ رجوع</button>
            <button className="btn primary" onClick={save}>{safe ? "حفظ والانتقال لإدخال مقررات الفصل ←" : "حفظ والانتقال إلى «كيف أتجنب الاستنفاذ» ←"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
