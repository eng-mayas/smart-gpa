import React, { useMemo, useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { Field, NumberInput, Progress, Stat } from "../components/common";
import { fmtGpa, gpaToPct } from "../../core/format";
import { BUILTIN_PLANS, courseLabel, eligibleCourses, levelOf, parseCodes, parsePlanText, planToCsv, projectGraduation, repeatStrategy, suggestRegistration, summarizePlan, PlanCourse, PlanProgressEntry, StudyPlan } from "../../core/plan";
import { newCourse } from "../../core/gpa";

const STATUS_AR = { done: "منجز", registered: "مسجّل", remaining: "متبقٍ" } as const;
const TYPE_AR = { core: "إجباري", elective: "اختياري", university: "متطلب جامعة" } as const;

export function PlanPage({ go }: { go: (p: string) => void }) {
  const { state, dispatch, scale, policy, currentState, activePlan: plan, planProgress: progress } = useAcademic();
  const [editPrereq, setEditPrereq] = useState<string | null>(null);
  const overridesForPlan = plan ? state.planOverrides[plan.id] ?? {} : {};
  const setOverride = (code: string, override: { prereqs?: string[]; coreqs?: string[] } | null) => plan && dispatch({ type: "planOverride", planId: plan.id, code, override });
  const [filter, setFilter] = useState<"all" | "done" | "registered" | "remaining" | "eligible">("all");
  const [search, setSearch] = useState("");
  const [maxCredits, setMaxCredits] = useState<number | "">(18);
  const [assumedGpa, setAssumedGpa] = useState<number | "">(3.0);
  const [targetCgpa, setTargetCgpa] = useState<number | "">(2.0);
  const [pasteText, setPasteText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const summary = useMemo(() => (plan ? summarizePlan(plan, progress, scale) : null), [plan, progress, scale]);
  const elig = useMemo(() => (plan ? eligibleCourses(plan, progress, scale) : []), [plan, progress, scale]);
  const atRisk = currentState.status !== "good" && currentState.status !== "not_evaluated";
  const suggestion = useMemo(() => (plan ? suggestRegistration(plan, progress, { maxCredits: maxCredits === "" ? 18 : maxCredits, atRisk }, scale) : null), [plan, progress, maxCredits, atRisk, scale]);
  const repeats = useMemo(() => (plan ? repeatStrategy(plan, progress, "B", scale) : []), [plan, progress, scale]);
  const grad = summary ? projectGraduation(summary, assumedGpa === "" ? 3 : assumedGpa, maxCredits === "" ? 18 : maxCredits, targetCgpa === "" ? undefined : targetCgpa, scale) : null;

  const setEntry = (code: string, patch: Partial<PlanProgressEntry> | null) => {
    const next = { ...state.planProgress };
    if (patch === null) delete next[code];
    else next[code] = { status: "remaining", ...progress[code], ...next[code], ...patch };
    dispatch({ type: "planProgress", progress: next });
  };

  const choosePlan = (id: string) => dispatch({ type: "set", patch: { planId: id || null } });

  const importPlan = () => {
    const r = parsePlanText(pasteText);
    if (r.courses.length === 0) return setImportMsg("لم يُتعرَّف على أي مقرر. تأكد من الصيغة: رمز، اسم، ساعات، متطلب سابق.");
    const custom: StudyPlan = {
      id: "custom", universityAr: state.profile.university, majorAr: state.profile.major, totalCredits: Math.max(state.profile.planCredits, r.courses.reduce((s, c) => s + c.credits, 0)),
      verification: "draft", sourceRef: "خطة مرفوعة من الطالب", courses: r.courses,
    };
    dispatch({ type: "set", patch: { customPlan: custom, planId: "custom" } });
    setImportMsg(`تم استيراد ${r.courses.length} مقرراً${r.errors.length ? ` (تجاهلنا ${r.errors.length} سطراً غير مفهوم)` : ""}.`);
    setPasteText("");
  };

  const registerSuggested = () => {
    if (!suggestion) return;
    const courses = suggestion.courses.map((c) => newCourse({ id: `plan-${c.code}`, name: c.nameAr ?? c.name, credits: c.credits }));
    dispatch({ type: "courses", courses });
    go("semester");
  };

  const syncProfile = () => {
    if (!summary) return;
    dispatch({ type: "profile", patch: { completedCredits: summary.doneCredits, planCredits: summary.totalCredits, remainingCourses: summary.remainingCount, ...(summary.cgpaFromPlan !== null ? { previousCgpa: summary.cgpaFromPlan, previousGpaHours: summary.gpaHours } : {}) } });
  };

  const visible = (plan?.courses ?? []).filter((c) => {
    const e = progress[c.code];
    const st = e?.status ?? "remaining";
    const q = search.trim().toLowerCase();
    if (q && !(c.code.includes(q) || c.name.toLowerCase().includes(q) || (c.nameAr ?? "").includes(q))) return false;
    if (filter === "all") return true;
    if (filter === "eligible") return st !== "done" && (elig.find((x) => x.course.code === c.code)?.eligible ?? false);
    return st === filter;
  });
  const byLevel = new Map<number, PlanCourse[]>();
  for (const c of visible) { const l = levelOf(c.code) ?? 0; byLevel.set(l, [...(byLevel.get(l) ?? []), c]); }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>الخطة الدراسية</h1>
          <p className="muted">اختر خطة جاهزة أو ارفع خطتك، وحدّد حالة كل مقرر؛ يقترح التطبيق تسجيل الفصل القادم ويحسب موعد التخرج.</p>
        </div>
        <div className="row">
          <select className="input" style={{ width: "auto" }} value={state.planId ?? ""} onChange={(e) => choosePlan(e.target.value)}>
            <option value="">— اختر خطة —</option>
            {BUILTIN_PLANS.map((p) => <option key={p.id} value={p.id}>{p.universityAr} — {p.majorAr}</option>)}
            {state.customPlan && <option value="custom">خطتي المرفوعة ({state.customPlan.courses.length} مقرر)</option>}
          </select>
        </div>
      </div>

      {!plan && (
        <div className="card mb">
          <h2>رفع خطة دراسية</h2>
          <p className="muted">الصق المقررات سطراً سطراً (من Excel أو بوابة الجامعة): <span className="kbd">الرمز, الاسم, الساعات, المتطلب السابق</span>. يمكن فصل الأعمدة بفاصلة أو | أو Tab. أو اختر خطة جاهزة من الأعلى.</p>
          <textarea className="input" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"301201, تحليل هندسي (1), 3, 601102\n302212, بنى المعطيات, 3, 302211;302202\n604101, English Skills (1), 3"} style={{ direction: "ltr", fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} />
          <div className="row mt">
            <button className="btn primary" onClick={importPlan} disabled={!pasteText.trim()}>استيراد الخطة</button>
            <button className="btn" onClick={() => go("import")}>أو استورد من كشف العلامات (صورة/نص)</button>
            {importMsg && <span className="tiny">{importMsg}</span>}
          </div>
        </div>
      )}

      {plan && summary && grad && (
        <>
          <div className="alert info mb">
            <div>
              <b>{plan.universityAr} — {plan.majorAr}</b> · {plan.courses.length} مقرر · {summary.totalCredits} ساعة ·
              {plan.verification === "verified" ? <span className="badge green">موثّقة</span> : <span className="badge yellow">مسودة — تحقق من المتطلبات السابقة</span>}
              <div className="tiny">{plan.sourceRef}</div>
            </div>
          </div>

          <div className="grid grid-5 mb">
            <Stat label="ساعات منجزة" value={summary.doneCredits} sub={`${summary.doneCount} مقرر`} accent="var(--green)" />
            <Stat label="مسجّلة الآن" value={summary.registeredCredits} accent="var(--primary)" />
            <Stat label="متبقية للتخرج" value={summary.remainingCredits} sub={`≈ ${grad.semestersNeeded} فصل بحمل ${maxCredits || 18} ساعة`} accent="var(--orange)" />
            <Stat label="المعدل من الخطة" value={fmtGpa(summary.cgpaFromPlan)} sub={summary.cgpaFromPlan !== null ? `${gpaToPct(summary.cgpaFromPlan, scale)} · ${summary.gpaHours} ساعة` : "أدخل علامات المقررات المنجزة"} accent="var(--gold)" />
            <Stat label="معدل التخرج المتوقع" value={fmtGpa(grad.projectedCgpa)} sub={`إن حافظت على ${assumedGpa || 3} في المتبقي`} accent="var(--teal)" />
          </div>
          <div className="card mb">
            <div className="row between">
              <span className="tiny">{summary.doneCredits} / {summary.totalCredits} ساعة</span>
              <button className="btn sm" onClick={syncProfile}>↻ مزامنة الملف الشخصي من الخطة</button>
            </div>
            <Progress value={summary.doneCredits} max={summary.totalCredits} />
          </div>

          <div className="grid grid-3 mb">
            <div className="card" style={{ gridColumn: "span 2" }}>
              <div className="card-head">
                <h2>اقتراح تسجيل الفصل القادم</h2>
                <div className="row">
                  <span className="tiny">الحد الأقصى للساعات</span>
                  <NumberInput value={maxCredits} min={3} max={24} onChange={setMaxCredits} className="sm" />
                </div>
              </div>
              {suggestion && suggestion.courses.length > 0 ? (
                <>
                  <p className="tiny">{suggestion.rationaleAr}</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>الرمز</th><th>المقرر</th><th className="c">ساعات</th><th className="c">المستوى</th><th>سبب الترتيب</th></tr></thead>
                      <tbody>
                        {suggestion.courses.map((c) => {
                          const e = progress[c.code];
                          const failed = e?.status === "done";
                          return (
                            <tr key={c.code}>
                              <td className="num">{c.code}</td>
                              <td>{courseLabel(c)}</td>
                              <td className="c num">{c.credits}</td>
                              <td className="c num">{levelOf(c.code) ?? "—"}</td>
                              <td className="tiny">{failed ? <span className="badge red">إعادة مقرر راسب</span> : c.coreqs?.length ? "متطلب متزامن" : "يفتح مقررات لاحقة"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot><tr><td colSpan={2}>المجموع</td><td className="c num">{suggestion.credits}</td><td colSpan={2}></td></tr></tfoot>
                    </table>
                  </div>
                  <div className="row mt"><button className="btn primary" onClick={registerSuggested}>اعتماد هذا التسجيل كفصل حالي →</button></div>
                </>
              ) : <p className="muted">لا توجد مقررات متاحة للتسجيل (حدّد المقررات المنجزة أولاً).</p>}
            </div>
            <div className="card">
              <h3>محاكي التخرج</h3>
              <div className="stack">
                <Field label="المعدل الفصلي المفترض في المتبقي"><NumberInput value={assumedGpa} min={0} max={scale.maxPoints} step={0.05} onChange={setAssumedGpa} /></Field>
                <Field label="المعدل التراكمي المستهدف عند التخرج"><NumberInput value={targetCgpa} min={0} max={scale.maxPoints} step={0.05} onChange={setTargetCgpa} /></Field>
                <div className="alert info">
                  <div>
                    تتخرج بعد ≈ <b>{grad.semestersNeeded}</b> فصل بمعدل متوقع <b className="num">{fmtGpa(grad.projectedCgpa)}</b>.
                    {targetCgpa !== "" && (grad.gpaNeededForTarget === null
                      ? <div style={{ color: "var(--red)" }}>الهدف {fmtGpa(targetCgpa)} غير قابل للتحقيق حتى بعلامات كاملة في المتبقي.</div>
                      : <div>للوصول إلى {fmtGpa(targetCgpa)} تحتاج معدلاً فصلياً ≥ <b className="num">{fmtGpa(grad.gpaNeededForTarget)}</b> في الساعات المتبقية.</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {repeats.length > 0 && (
            <div className="card mb">
              <h2>إعادة استراتيجية: أي مقرر أعيده أولاً؟</h2>
              <p className="tiny">الترتيب حسب أثر الإعادة على المعدل التراكمي إذا حصلت على B (تُستبدل المحاولة القديمة بالجديدة).</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>المقرر</th><th className="c">ساعات</th><th className="c">الحالية</th><th className="c">رفع المعدل عند B</th><th className="c">رفع المعدل عند {scale.maxPoints}</th></tr></thead>
                  <tbody>
                    {repeats.slice(0, 8).map((r) => (
                      <tr key={r.course.code}>
                        <td>{courseLabel(r.course)} <span className="tiny num">{r.course.code}</span></td>
                        <td className="c num">{r.course.credits}</td>
                        <td className="c grade-cell">{r.currentLetter}</td>
                        <td className="c num" style={{ color: "var(--green)", fontWeight: 700 }}>+{r.gainAtTarget.toFixed(3)}</td>
                        <td className="c num">+{r.gainAtMax.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2>مقررات الخطة</h2>
              <div className="row">
                <input className="input" placeholder="بحث بالرمز أو الاسم" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 180 }} />
                <div className="segmented">
                  {(["all", "eligible", "remaining", "registered", "done"] as const).map((f) => (
                    <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{{ all: "الكل", eligible: "متاح للتسجيل", remaining: "متبقٍ", registered: "مسجّل", done: "منجز" }[f]}</button>
                  ))}
                </div>
                <button className="btn sm" onClick={() => navigator.clipboard?.writeText(planToCsv(plan))}>نسخ CSV</button>
              </div>
            </div>
            {[...byLevel.keys()].sort().map((lvl) => (
              <div key={lvl} className="mb">
                <h3 className="muted">{lvl ? `المستوى ${lvl}` : "غير مصنّف"}</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>الرمز</th><th>المقرر</th><th className="c">ساعات</th><th className="c">النوع</th><th>المتطلب السابق</th><th className="c">الحالة</th><th className="c">العلامة</th></tr></thead>
                    <tbody>
                      {byLevel.get(lvl)!.map((c) => {
                        const e = progress[c.code];
                        const st = e?.status ?? "remaining";
                        const el = elig.find((x) => x.course.code === c.code);
                        return (
                          <tr key={c.code}>
                            <td className="num">{c.code}</td>
                            <td>{courseLabel(c)}{c.note && <div className="tiny">{c.note}</div>}</td>
                            <td className="c num">{c.credits}</td>
                            <td className="c tiny">{TYPE_AR[c.type]}</td>
                            <td className="tiny num" style={{ minWidth: 170 }}>
                              {editPrereq === c.code ? (
                                <div className="stack" style={{ gap: 4 }}>
                                  <input className="input" dir="ltr" placeholder="601102, 601101 (فارغ = بلا متطلب)" defaultValue={c.prereqs.join(", ")} autoFocus
                                    onKeyDown={(ev) => { if (ev.key === "Enter") { setOverride(c.code, { prereqs: parseCodes((ev.target as HTMLInputElement).value) }); setEditPrereq(null); } if (ev.key === "Escape") setEditPrereq(null); }}
                                    onBlur={(ev) => { setOverride(c.code, { prereqs: parseCodes(ev.target.value) }); setEditPrereq(null); }} />
                                  <span className="tiny" style={{ direction: "rtl" }}>Enter للحفظ · Esc للإلغاء</span>
                                </div>
                              ) : (
                                <>
                                  <span style={{ cursor: "pointer", borderBottom: "1px dashed var(--text-3)" }} title="انقر لتعديل المتطلب السابق" onClick={() => setEditPrereq(c.code)}>
                                    {c.prereqs.join(", ") || "بلا متطلب"}
                                  </span>
                                  {c.coreqs?.length ? ` (متزامن: ${c.coreqs.join(", ")})` : ""}
                                  {overridesForPlan[c.code] && <button className="btn ghost sm" title="استعادة الأصل" onClick={() => setOverride(c.code, null)}>↺</button>}
                                  {st !== "done" && el && !el.eligible && <div style={{ color: "var(--orange)" }}>ناقص: {el.missing.join(", ")}</div>}
                                </>
                              )}
                            </td>
                            <td className="c">
                              <select className="input" style={{ width: "auto" }} value={st} onChange={(ev) => setEntry(c.code, ev.target.value === "remaining" ? null : { status: ev.target.value as PlanProgressEntry["status"] })}>
                                {(Object.keys(STATUS_AR) as (keyof typeof STATUS_AR)[]).map((k) => <option key={k} value={k}>{STATUS_AR[k]}</option>)}
                              </select>
                            </td>
                            <td className="c">
                              {st === "done" && (
                                <select className="input" style={{ width: "auto" }} value={e?.letter ?? ""} onChange={(ev) => setEntry(c.code, { letter: ev.target.value || undefined })}>
                                  <option value="">بدون علامة</option>
                                  {scale.bands.map((b) => <option key={b.letter} value={b.letter}>{b.letter}</option>)}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {visible.length === 0 && <p className="muted">لا توجد مقررات مطابقة.</p>}
            <p className="tiny">حالات المقررات تُحسب تلقائياً من «فصولي» والفصل الحالي؛ يمكنك تحديدها يدوياً للمقررات المنقولة أو غير المسجلة. · انقر على المتطلب السابق لأي مقرر لتصحيحه (اتركه فارغاً إن كان المقرر بلا متطلب)؛ التصحيحات تُحفظ على جهازك وتظهر بعلامة ↺. · وفق سياسة {policy.universityNameAr}: {atRisk ? "أنت في وضع إنذار، لذا يُقترح حمل مخفّف." : "وضعك سليم."}</p>
          </div>
        </>
      )}
    </>
  );
}
