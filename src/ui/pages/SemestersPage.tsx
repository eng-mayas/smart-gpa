import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { SemesterEntry, semesterToRecord } from "../../state/store";
import { CourseTable } from "../components/CourseTable";
import { NumberInput, Stat, StatusBadge, LineChart, Gauge } from "../components/common";
import { fmtDelta, fmtGpa, gpaToPct } from "../../core/format";
import { calculateSemester, newCourse } from "../../core/gpa";

/**
 * «فصولي» — the single place where the student records semesters.
 * Completed semesters (detailed or quick) + the current semester (live GPA).
 */
export function SemestersPage({ go }: { go: (p: string) => void }) {
  const { state, dispatch, scale, policy, semester, cumulative, timeline, currentState, predicted, activePlan, derivedProfile } = useAcademic();
  const [open, setOpen] = useState<string | null>(null);
  const sems = state.semesters;
  const setSems = (s: SemesterEntry[]) => dispatch({ type: "semesters", semesters: s });
  const update = (id: string, patch: Partial<SemesterEntry>) => setSems(sems.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => confirm("حذف هذا الفصل؟") && setSems(sems.filter((s) => s.id !== id));
  const nextLabel = () => `${state.profile.academicYear || "فصل"} / ف${sems.length + 1}`;
  const addQuick = () => { const id = Math.random().toString(36).slice(2, 8); setSems([...sems, { id, label: nextLabel(), kind: "quick", courses: [], gpa: 2.0, gpaHours: 15, earnedCredits: 15 }]); setOpen(id); };
  const addDetailed = () => { const id = Math.random().toString(36).slice(2, 8); setSems([...sems, { id, label: nextLabel(), kind: "detailed", courses: [newCourse({ name: "" })] }]); setOpen(id); };

  const finishCurrent = () => {
    if (semester.gpa === null) return;
    if (!confirm("سيُنقل الفصل الحالي إلى الفصول المكتملة ويُفرَّغ الجدول لبدء فصل جديد. متابعة؟")) return;
    setSems([...sems, { id: Math.random().toString(36).slice(2, 8), label: nextLabel(), kind: "detailed", courses: state.courses }]);
    dispatch({ type: "courses", courses: [] });
    // Profile numbers are now derived from semesters; clear manual ones to avoid confusion.
    dispatch({ type: "profile", patch: { previousCgpa: 0, previousGpaHours: 0, completedCredits: 0, previousWarnings: 0 } });
  };

  const points = (s: SemesterEntry) => semesterToRecord(s, scale);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>فصولي</h1>
          <p className="muted">سجّل فصولك كما في كشف علاماتك. كل شيء آخر — المعدل، الخطة، الإنذارات، التوصيات — يُحسب من هنا تلقائياً.</p>
        </div>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="المعدل التراكمي" value={fmtGpa(derivedProfile.previousGpaHours ? derivedProfile.previousCgpa : null)} sub={derivedProfile.previousGpaHours ? `${gpaToPct(derivedProfile.previousCgpa, scale)} · ${derivedProfile.previousGpaHours} ساعة` : "لا فصول مكتملة بعد"} accent={derivedProfile.previousCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
        <Stat label="فصول مكتملة" value={sems.length} sub={`${derivedProfile.completedCredits} ساعة منجزة`} accent="var(--primary)" />
        <Stat label="الفصل الحالي" value={fmtGpa(semester.gpa)} sub={`${semester.gpaCredits} من ${semester.totalCredits} ساعة مُدخلة`} accent="var(--teal)" />
        <Stat label="التراكمي المتوقع بعده" value={fmtGpa(cumulative.newCgpa)} sub={fmtDelta(cumulative.delta)} accent={cumulative.newCgpa !== null && cumulative.newCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
      </div>

      {/* Current semester */}
      <div className="card mb" style={{ borderInlineStart: "5px solid var(--teal)" }}>
        <div className="card-head">
          <div className="row">
            <h2 style={{ margin: 0 }}>الفصل الحالي</h2>
            <span className="badge teal">جارٍ</span>
            {predicted.evaluated && <StatusBadge status={predicted.to.status} />}
          </div>
          <div className="row">
            {activePlan && <button className="btn sm" onClick={() => go("plan")}>اختيار من الخطة</button>}
            <button className="btn sm" onClick={() => go("progress")}>العلامات الجزئية</button>
            <button className="btn primary sm" onClick={finishCurrent} disabled={semester.gpa === null || semester.missingGrades > 0} title={semester.missingGrades > 0 ? "أكمل العلامات أولاً" : ""}>✓ انتهى الفصل</button>
          </div>
        </div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} planCourses={activePlan?.courses} />
        {predicted.evaluated && <p className="tiny mt">{predicted.explanationAr}</p>}
      </div>

      {/* Completed semesters */}
      <div className="card">
        <div className="card-head">
          <h2>الفصول المكتملة</h2>
          <div className="row">
            <button className="btn sm" onClick={addQuick}>+ فصل سريع (معدل وساعات)</button>
            <button className="btn primary sm" onClick={addDetailed}>+ فصل مفصّل (مقررات)</button>
            <button className="btn sm" onClick={() => go("import")}>استيراد من كشف</button>
          </div>
        </div>
        {sems.length === 0 && <p className="muted">لا فصول بعد. أضف فصولك السابقة — بالتفصيل (يغذّي الخطة تلقائياً) أو بسرعة (المعدل والساعات فقط).</p>}
        <div className="stack">
          {sems.map((s, i) => {
            const rec = points(s);
            const tl = timeline[i];
            const isOpen = open === s.id;
            return (
              <div key={s.id} className="card" style={{ padding: "0.8rem 1rem", borderInlineStart: `5px solid ${rec.gpa !== null && rec.gpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"}` }}>
                <div className="row between" style={{ cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : s.id)}>
                  <div className="row">
                    <b className="num">{i + 1}.</b>
                    <input className="input" value={s.label} onClick={(e) => e.stopPropagation()} onChange={(e) => update(s.id, { label: e.target.value })} style={{ width: 170 }} />
                    <span className={`badge ${s.kind === "detailed" ? "blue" : "gray"}`}>{s.kind === "detailed" ? `${s.courses.length} مقرر` : "سريع"}</span>
                    <span className="num">فصلي <b>{fmtGpa(rec.gpa)}</b></span>
                    <span className="num tiny">تراكمي بعده <b>{fmtGpa(tl?.cgpa)}</b> · {tl?.cumulativeHours ?? 0} ساعة</span>
                    {tl && <StatusBadge status={tl.transition.to.status} />}
                  </div>
                  <div className="row">
                    <button className="btn ghost sm danger" onClick={(e) => { e.stopPropagation(); remove(s.id); }}>✕</button>
                    <span className="muted">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt">
                    {s.kind === "quick" ? (
                      <div className="row">
                        <label className="field"><span>المعدل الفصلي</span><NumberInput value={s.gpa ?? ""} min={0} max={scale.maxPoints} step={0.01} onChange={(v) => update(s.id, { gpa: v === "" ? null : v })} /></label>
                        <label className="field"><span>الساعات المحسوبة</span><NumberInput value={s.gpaHours ?? 0} min={0} max={30} onChange={(v) => update(s.id, { gpaHours: v === "" ? 0 : v, earnedCredits: s.earnedCredits ?? (v === "" ? 0 : v) })} /></label>
                        <label className="field"><span>الساعات المكتسبة (الناجحة)</span><NumberInput value={s.earnedCredits ?? s.gpaHours ?? 0} min={0} max={30} onChange={(v) => update(s.id, { earnedCredits: v === "" ? 0 : v })} /></label>
                        <button className="btn sm" onClick={() => update(s.id, { kind: "detailed", courses: s.courses.length ? s.courses : [newCourse({ name: "" })] })}>تحويل إلى مفصّل</button>
                      </div>
                    ) : (
                      <CourseTable courses={s.courses} onChange={(c) => update(s.id, { courses: c })} result={calculateSemester(s.courses, scale)} scale={scale} planCourses={activePlan?.courses} showWeighted={false} />
                    )}
                    {tl && <p className="tiny mt">{tl.transition.explanationAr}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="grid grid-3 mt">
          <div className="card" style={{ gridColumn: "span 2" }}>
            <h3>تطور المعدل</h3>
            <LineChart
              labels={[...timeline.map((e) => e.record.label.split("/").pop()?.trim() ?? ""), "الحالي"]}
              series={[
                { name: "فصلي", data: [...timeline.map((e) => e.record.gpa), semester.gpa], color: "var(--teal)" },
                { name: "تراكمي", data: [...timeline.map((e) => e.cgpa), cumulative.newCgpa], color: "var(--primary)" },
              ]}
              max={scale.maxPoints}
              thresholds={[{ value: policy.goodStandingMin, label: "سليم", color: "var(--green)" }, { value: policy.specializationDismissalBelow, label: "فصل", color: "var(--red)" }]}
            />
          </div>
          <div className="card row" style={{ justifyContent: "center", flexDirection: "column" }}>
            <Gauge value={derivedProfile.previousGpaHours ? derivedProfile.previousCgpa : null} max={scale.maxPoints} label="التراكمي الآن" />
            <StatusBadge status={currentState.status} lg />
          </div>
        </div>
      )}
    </>
  );
}
