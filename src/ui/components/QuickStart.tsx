import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { NumberInput, StatusBadge } from "./common";
import { fmtGpa, gpaToPct } from "../../core/format";
import { stateFromProfile } from "../../state/useAcademic";
import { nextThresholds } from "../../core/rules";
import { requiredSemesterGpa } from "../../core/predictor";
import { UNIVERSITIES, OTHER_UNIVERSITY } from "../../core/universities";

/** One-line quick start shown above the dashboard while demo data is untouched. */
export function QuickStart({ onDone, go }: { onDone: () => void; go: (p: string) => void }) {
  const { dispatch, scale, policy } = useAcademic();
  const [university, setUniversity] = useState("");
  const [cgpa, setCgpa] = useState<number | "">("");
  const [hours, setHours] = useState<number | "">("");
  const [warnings, setWarnings] = useState<number | "">(0);
  const ready = cgpa !== "" && hours !== "";
  const c = cgpa === "" ? 0 : cgpa, h = hours === "" ? 0 : hours, w = warnings === "" ? 0 : warnings;
  const st = stateFromProfile(w, h, Math.max(2, Math.round(h / 15)));
  const th = nextThresholds(st, policy, 0);
  const req = requiredSemesterGpa({ previousCgpa: c, previousGpaHours: h, semesterHours: 15, targetCgpa: th.safe });
  const safe = c >= policy.goodStandingMin;

  const save = () => {
    const uni = UNIVERSITIES.find((u) => u.id === university);
    dispatch({ type: "reset" });
    dispatch({ type: "profile", patch: { university: uni?.nameAr ?? (university === "other" ? "" : ""), previousCgpa: c, previousGpaHours: h, completedCredits: h, previousWarnings: w } });
    if (uni) dispatch({ type: "set", patch: { policyId: uni.policyId } });
    onDone();
    go(safe ? "semester" : "exhaustion");
  };

  return (
    <div className="card mb" style={{ borderInlineStart: "5px solid var(--gold)" }}>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="row" style={{ flex: 1, alignItems: "flex-end" }}>
          <label className="field" style={{ minWidth: 220 }}>
            <span>جامعتك</span>
            <select className="input" value={university} onChange={(e) => setUniversity(e.target.value)}>
              <option value="">— اختر —</option>
              {UNIVERSITIES.map((u) => <option key={u.id} value={u.id}>{u.nameAr}</option>)}
              <option value="other">{OTHER_UNIVERSITY}</option>
            </select>
          </label>
          <label className="field" style={{ width: 130 }}><span>معدلك التراكمي</span><NumberInput value={cgpa} min={0} max={scale.maxPoints} step={0.01} onChange={setCgpa} placeholder="1.85" /></label>
          <label className="field" style={{ width: 130 }}><span>الساعات المحسوبة</span><NumberInput value={hours} min={0} max={300} onChange={setHours} placeholder="60" /></label>
          <label className="field" style={{ width: 110 }}><span>الإنذارات</span><NumberInput value={warnings} min={0} max={3} onChange={setWarnings} /></label>
        </div>
        <div className="row">
          <button className="btn primary" onClick={save} disabled={!ready}>ابدأ ببياناتي ←</button>
          <button className="btn ghost sm" onClick={onDone}>تجاهل</button>
        </div>
      </div>
      {ready ? (
        <div className={`alert ${safe ? "ok" : "warn"} mt`} style={{ alignItems: "center" }}>
          <StatusBadge status={st.status} />
          <div>
            المعدل {fmtGpa(c)} = {gpaToPct(c, scale)}.{" "}
            {safe
              ? <>وضعك سليم — للبقاء فيه يكفي معدل فصلي ≥ {fmtGpa(policy.goodStandingMin)}.</>
              : <>تحتاج معدلاً فصلياً ≈ <b className="num">{req === null ? "—" : req > scale.maxPoints ? "أعلى من الممكن (أكثر من فصل)" : fmtGpa(req)}</b> على 15 ساعة للعودة إلى {fmtGpa(policy.goodStandingMin)}.</>}
          </div>
        </div>
      ) : (
        <p className="tiny mt" style={{ margin: 0 }}>🧪 الأرقام أدناه تجريبية للتعرف على التطبيق. أدخل معدلك وساعاتك ليحلّ مكانها فوراً — أو تجاهل واستكشف.</p>
      )}
    </div>
  );
}
