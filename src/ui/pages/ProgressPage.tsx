import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { NumberInput, Stat, StatusBadge } from "../components/common";
import { fmtGpa } from "../../core/format";
import { DEFAULT_COMPONENTS, GradeComponent, neededForEachLetter, standing } from "../../core/components";
import { calculateSemester, combineCgpa, Course } from "../../core/gpa";
import { markToBand } from "../../core/grading";
import { transition } from "../../core/rules";

export function ProgressPage({ go }: { go: (p: string) => void }) {
  const { state, dispatch, scale, policy, currentState, projectedCredits } = useAcademic();
  const [open, setOpen] = useState<string | null>(state.courses[0]?.id ?? null);
  const courses = state.courses.filter((c) => c.status !== "withdrawn" && c.status !== "excluded");
  const comps = (c: Course): GradeComponent[] => state.components[c.id] ?? DEFAULT_COMPONENTS.map((x) => ({ ...x }));
  const setComps = (c: Course, list: GradeComponent[]) => dispatch({ type: "components", courseId: c.id, components: list });

  // Projected semester from in-semester standing (courses without any score keep their entered grade)
  const projectedCourses: Course[] = state.courses.map((c) => {
    const s = standing(comps(c));
    if (s.projectedMark === null) return c;
    return { ...c, grade: { kind: "mark", value: Math.round(s.projectedMark * 10) / 10 } };
  });
  const projected = calculateSemester(projectedCourses, scale);
  const projCgpa = projected.gpa === null ? null : combineCgpa(state.profile.previousCgpa, state.profile.previousGpaHours, projected.gpa, projected.gpaCredits);
  const predicted = transition(currentState, projCgpa, policy, projectedCredits);
  const scoredCount = courses.filter((c) => standing(comps(c)).doneWeight > 0).length;

  const adoptAll = () => {
    dispatch({ type: "courses", courses: projectedCourses });
    go("semester");
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>علاماتي خلال الفصل</h1>
          <p className="muted">سجّل المذاكرات والوظائف والعملي أولاً بأول؛ يحسب التطبيق وضعك الحالي في كل مقرر وما تحتاجه في الامتحان النهائي لكل حرف.</p>
        </div>
        <button className="btn" onClick={adoptAll} disabled={scoredCount === 0}>اعتماد العلامات المتوقعة في جدول الفصل →</button>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="مقررات فيها علامات جزئية" value={`${scoredCount} / ${courses.length}`} accent="var(--primary)" />
        <Stat label="المعدل الفصلي المتوقع" value={fmtGpa(projected.gpa)} sub="إن استمر أداؤك الحالي في الباقي" accent="var(--teal)" />
        <Stat label="التراكمي المتوقع" value={fmtGpa(projCgpa)} accent={projCgpa !== null && projCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
        <div className="stat" style={{ ["--accent" as string]: "var(--gold)" }}>
          <div className="label">إنذار مبكر</div>
          <div style={{ marginTop: 6 }}>{predicted.evaluated ? <StatusBadge status={predicted.to.status} lg /> : <span className="tiny">أدخل علامات جزئية</span>}</div>
          {predicted.evaluated && <div className="sub" style={{ marginTop: 4 }}>{predicted.to.status === "good" ? "على المسار الصحيح" : "تنبيه: الأداء الحالي يقودك إلى هذه الحالة"}</div>}
        </div>
      </div>

      {courses.length === 0 && <div className="alert warn">أضف مقررات الفصل أولاً من صفحة المعدل الفصلي أو من الخطة الدراسية.</div>}

      {courses.map((c) => {
        const list = comps(c);
        const s = standing(list);
        const needed = neededForEachLetter(list, scale);
        const isOpen = open === c.id;
        const projBand = s.projectedMark === null ? null : markToBand(s.projectedMark, scale);
        return (
          <div className="card" key={c.id}>
            <div className="card-head" style={{ cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : c.id)}>
              <div className="row">
                <h2 style={{ margin: 0 }}>{c.name || "مقرر"}</h2>
                <span className="badge gray">{c.credits} ساعة</span>
                {projBand && <span className={`badge ${projBand.pass ? (projBand.points >= 3 ? "green" : "teal") : "red"}`}>متوقع: {projBand.letter} ({s.projectedMark!.toFixed(1)})</span>}
                {s.doneWeight > 0 && <span className="tiny">مضمون حتى الآن: <b className="num">{s.securedMark.toFixed(1)}</b> من 100 · أقصى ممكن: <b className="num">{s.maxPossibleMark.toFixed(1)}</b></span>}
              </div>
              <span className="muted">{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div className="grid grid-2">
                <div>
                  <h3>مكوّنات العلامة</h3>
                  {!s.weightsValid && <div className="alert warn tiny">مجموع الأوزان {s.totalWeight}% وليس 100%.</div>}
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>المكوّن</th><th className="c">الوزن %</th><th className="c">علامتي</th><th className="c">من</th><th className="c">نهائي؟</th><th></th></tr></thead>
                      <tbody>
                        {list.map((g) => (
                          <tr key={g.id}>
                            <td><input className="input" value={g.name} onChange={(e) => setComps(c, list.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x))} /></td>
                            <td className="c" style={{ width: 80 }}><NumberInput value={g.weight} min={0} max={100} onChange={(v) => setComps(c, list.map((x) => x.id === g.id ? { ...x, weight: v === "" ? 0 : v } : x))} /></td>
                            <td className="c" style={{ width: 90 }}><NumberInput value={g.score ?? ""} min={0} max={g.max ?? 100} step={0.5} placeholder="—" onChange={(v) => setComps(c, list.map((x) => x.id === g.id ? { ...x, score: v === "" ? undefined : v } : x))} /></td>
                            <td className="c" style={{ width: 95 }}><NumberInput value={g.max ?? 100} min={1} max={1000} onChange={(v) => setComps(c, list.map((x) => x.id === g.id ? { ...x, max: v === "" ? 100 : v } : x))} /></td>
                            <td className="c"><input type="checkbox" checked={!!g.isFinal} onChange={(e) => setComps(c, list.map((x) => x.id === g.id ? { ...x, isFinal: e.target.checked } : x))} /></td>
                            <td><button className="btn ghost sm danger" onClick={() => setComps(c, list.filter((x) => x.id !== g.id))}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row mt">
                    <button className="btn sm" onClick={() => setComps(c, [...list, { id: Math.random().toString(36).slice(2, 8), name: "مكوّن جديد", weight: 0 }])}>+ مكوّن</button>
                    <button className="btn sm" onClick={() => setComps(c, DEFAULT_COMPONENTS.map((x) => ({ ...x })))}>إعادة التوزيع الافتراضي</button>
                    {list.length > 0 && (
                      <button className="btn sm" onClick={() => { const copy = list.map((x) => ({ ...x, score: undefined })); courses.forEach((o) => o.id !== c.id && setComps(o, copy.map((x) => ({ ...x })))); }}>نسخ الأوزان إلى باقي المقررات</button>
                    )}
                  </div>
                </div>
                <div>
                  <h3>ماذا أحتاج في المتبقي ({s.remainingWeight}% من العلامة)؟</h3>
                  {s.remainingWeight <= 0 ? (
                    <p className="muted">كل المكوّنات مُدخلة — العلامة النهائية {s.securedMark.toFixed(1)}.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th className="c">الحرف</th><th className="c">أدنى علامة</th><th className="c">المطلوب في المتبقي</th><th></th></tr></thead>
                        <tbody>
                          {needed.map((n) => (
                            <tr key={n.letter}>
                              <td className="c grade-cell">{n.letter}</td>
                              <td className="c num">{n.targetMark}</td>
                              <td className="c num" style={{ fontWeight: 700, color: n.alreadySecured ? "var(--green)" : n.achievable ? (n.neededPct! > 85 ? "var(--orange)" : "var(--text)") : "var(--red)" }}>
                                {n.alreadySecured ? "مضمون ✓" : n.achievable ? `${n.neededPct!.toFixed(1)}%` : "غير ممكن"}
                              </td>
                              <td className="tiny">{!n.alreadySecured && n.achievable && n.neededPct! > 85 ? "صعب" : n.alreadySecured ? "" : n.achievable ? "" : "يتجاوز 100%"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="tiny mt">النسبة المطلوبة تُطبَّق على كل المكوّنات غير المُدخلة بعد (عادةً الامتحان النهائي). أدخل علامة المكوّن فور معرفتها ليتحدث الجدول.</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
