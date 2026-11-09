import React, { useMemo } from "react";
import { useAcademic } from "../../state/useAcademic";
import { mentor, Insight, Severity } from "../../core/mentor";
import { StatusBadge, RiskBadge } from "../components/common";
import { fmtGpa } from "../../core/format";

const SEV_STYLE: Record<Severity, { color: string; icon: string; label: string }> = {
  critical: { color: "var(--red)", icon: "⛔", label: "عاجل" },
  warning: { color: "var(--orange)", icon: "⚠", label: "انتبه" },
  todo: { color: "var(--gray)", icon: "☐", label: "أكمل" },
  info: { color: "var(--primary)", icon: "💡", label: "نصيحة" },
  good: { color: "var(--green)", icon: "✅", label: "جيد" },
};
const SECTION_AR: Record<Insight["section"], string> = {
  status: "أين أنت الآن",
  this_semester: "هذا الفصل",
  next_semester: "الفصل القادم",
  graduation: "الطريق إلى التخرج",
  data: "أكمل بياناتك",
};

export function useMentor() {
  const a = useAcademic();
  return useMemo(() => mentor({
    scale: a.scale, policy: a.policy, state: a.currentState,
    previousCgpa: a.derivedProfile.previousCgpa, previousGpaHours: a.derivedProfile.previousGpaHours, completedCredits: a.derivedProfile.completedCredits,
    semester: a.semester, courses: a.state.courses, components: a.state.components, plan: a.activePlan, progress: a.planProgress,
    semestersCount: a.state.semesters.length, quickSemesters: a.state.semesters.filter((s) => s.kind === "quick").length, lastBackup: a.state.lastBackup,
  }), [a]);
}

export function InsightCard({ i, go, compact }: { i: Insight; go: (r: string) => void; compact?: boolean }) {
  const s = SEV_STYLE[i.severity];
  return (
    <div className="card" style={{ borderInlineStart: `5px solid ${s.color}`, padding: compact ? "0.7rem 0.9rem" : undefined }}>
      <div className="row between">
        <div className="row" style={{ gap: "0.4rem" }}>
          <span>{s.icon}</span>
          <b>{i.title}</b>
        </div>
        {i.ref && <span className="badge gray">{i.ref}</span>}
      </div>
      <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.9rem" }}>{i.detail}</p>
      {i.action && !compact && <div className="row mt"><button className="btn sm" onClick={() => go(i.action!.route)}>{i.action.label} ←</button></div>}
    </div>
  );
}

export function MentorPage({ go }: { go: (p: string) => void }) {
  const { currentState, policy, derivedProfile, scale } = useAcademic();
  const { insights, paths } = useMentor();
  const sections = (Object.keys(SECTION_AR) as Insight["section"][]).map((k) => ({ key: k, items: insights.filter((i) => i.section === k) })).filter((s) => s.items.length > 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>المستشار الأكاديمي</h1>
          <p className="muted">تحليل آلي لفصولك وخطتك وفق لائحة {policy.universityNameAr}. كل توصية لها رقم وسبب — ولا تُغني عن مرشدك في الجامعة.</p>
        </div>
        <div className="row"><StatusBadge status={currentState.status} lg /><RiskBadge state={currentState} /></div>
      </div>

      {sections.map((s) => (
        <div key={s.key} className="mb">
          <h2 className="muted" style={{ fontSize: "1rem", margin: "0.8rem 0 0.5rem" }}>{SECTION_AR[s.key]}</h2>
          <div className="stack">{s.items.map((i) => <InsightCard key={i.id} i={i} go={go} />)}</div>
        </div>
      ))}

      {paths.length > 0 && (
        <div className="card mt">
          <h2>ثلاثة مسارات للتخرج</h2>
          <div className="grid grid-3">
            {paths.map((p) => (
              <div key={p.id} className="card" style={{ borderTop: `4px solid ${p.id === "fast" ? "var(--primary)" : p.id === "balanced" ? "var(--teal)" : "var(--gold)"}` }}>
                <h3>{p.nameAr}</h3>
                <div className="num" style={{ fontSize: "1.6rem", fontWeight: 800 }}>{p.semesters} <span className="tiny">فصل</span></div>
                <p className="tiny">{p.creditsPerSemester} ساعة/فصل · بمعدل مفترض {fmtGpa(p.assumedGpa)} (من {scale.maxPoints})</p>
                <p>معدل التخرج المتوقع: <b className="num">{fmtGpa(p.projectedCgpa)}</b></p>
                <ul className="tiny" style={{ margin: 0, paddingInlineStart: "1.1rem" }}>{p.risksAr.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="tiny mt">المعدل المفترض في «الأسرع» = أداؤك الحالي + 0.25، وفي «المحافظ» + 0.5 لأن الحمل الأخف يتيح تركيزاً أكبر. التراكمي الحالي {fmtGpa(derivedProfile.previousCgpa)}.</p>
        </div>
      )}
      <p className="tiny mt">كل الأرقام محسوبة حتمياً من بياناتك ومن نص اللائحة؛ لا يُستخدم ذكاء اصطناعي ولا تُرسل بياناتك إلى أي خادم.</p>
    </>
  );
}
