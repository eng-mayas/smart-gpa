import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_COMPUTER_ENGINEERING as PLAN } from "../src/core/plans/sample-computer-engineering";
import { summarizePlan, eligibleCourses, suggestRegistration, repeatStrategy, projectGraduation, parsePlanText, levelOf, unlockCount, PlanProgress } from "../src/core/plan";
import { standing, neededForEachLetter, neededForMark, GradeComponent } from "../src/core/components";
import { parseTranscriptText, normalizeDigits } from "../src/core/importer";
import { parseStudentsCsv, assessCohort, SAMPLE_STUDENTS_CSV } from "../src/core/advisor";
import { DRAFT_SY_PRIVATE_POLICY as P, UNIFIED_SY_PRIVATE_POLICY as U, INITIAL_STATE } from "../src/core/rules";
import { mentor } from "../src/core/mentor";
import { DEFAULT_SCALE } from "../src/core/grading";
import { calculateSemester, newCourse } from "../src/core/gpa";

const close = (a: number | null, b: number, eps = 1e-9) => { assert.ok(a !== null); assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`); };

describe("study plan", () => {
  test("built-in sample plan is consistent", () => {
    const codes = new Set(PLAN.courses.map((c) => c.code));
    assert.equal(codes.size, PLAN.courses.length, "duplicate codes");
    for (const c of PLAN.courses) for (const p of c.prereqs) assert.ok(codes.has(p), `${c.code} prereq ${p} missing`);
    assert.equal(PLAN.courses.reduce((s, c) => s + c.credits, 0), PLAN.totalCredits);
    assert.equal(levelOf("301201"), 2);
    assert.equal(levelOf("ENG101"), undefined);
  });
  test("summary, eligibility and prerequisites", () => {
    const progress: PlanProgress = { "601101": { status: "done", letter: "B" }, "401101": { status: "done", mark: 45 }, "604101": { status: "registered" } };
    const s = summarizePlan(PLAN, progress);
    assert.equal(s.doneCredits, 3);
    assert.equal(s.registeredCredits, 3);
    assert.equal(s.failedCourses[0].code, "401101");
    close(s.cgpaFromPlan, (3 * 3 + 0 * 3) / 6);
    const el = eligibleCourses(PLAN, progress);
    assert.equal(el.find((e) => e.course.code === "601102")?.eligible, true); // calc 1 passed
    assert.equal(el.find((e) => e.course.code === "301201")?.eligible, false); // needs calc 2
    assert.deepEqual(el.find((e) => e.course.code === "301201")?.missing, ["601102"]);
    assert.equal(el.find((e) => e.course.code === "401101")?.eligible, true); // failed → can retake
    assert.ok(unlockCount(PLAN, "601101") > 5);
  });
  test("registration suggestion respects credit cap, pulls corequisites, prioritizes failed", () => {
    const progress: PlanProgress = { "401101": { status: "done", mark: 40 } };
    const r = suggestRegistration(PLAN, progress, { maxCredits: 18 });
    assert.ok(r.credits <= 18 && r.credits > 0);
    assert.equal(r.courses[0].code, "401101"); // failed course first
    const at = suggestRegistration(PLAN, progress, { maxCredits: 18, atRisk: true });
    assert.ok(at.credits <= 15);
    if (r.courses.some((c) => c.code === "601103")) assert.ok(r.courses.some((c) => c.code === "601107") || r.credits > 17);
  });
  test("repeat strategy ranks by CGPA gain", () => {
    const progress: PlanProgress = { "601101": { status: "done", letter: "D" }, "604101": { status: "done", letter: "C" }, "301101": { status: "done", letter: "F" } };
    const rs = repeatStrategy(PLAN, progress, "B");
    assert.equal(rs[0].course.code, "601101"); // D in a 3-credit course beats F in a 1-credit course
    assert.ok(rs[0].gainAtTarget > 0 && rs[0].gainAtMax > rs[0].gainAtTarget);
  });
  test("graduation projection", () => {
    const s = summarizePlan(PLAN, { "601101": { status: "done", letter: "B" } });
    const g = projectGraduation(s, 3.0, 18, 2.0);
    assert.equal(g.remainingCredits, PLAN.totalCredits - 3);
    assert.equal(g.semestersNeeded, Math.ceil((PLAN.totalCredits - 3) / 18));
    close(g.projectedCgpa, (3 * 3 + 3.0 * (PLAN.totalCredits - 3)) / PLAN.totalCredits);
    assert.ok(g.gpaNeededForTarget !== null && g.gpaNeededForTarget < 2.0);
  });
  test("plan text import", () => {
    const r = parsePlanText("code,name,credits,prereqs\n301201, Engineering Analysis (1), 3, 601102\n302212 | بنى المعطيات | 3 | 302211;302202 | core\n999999 Some Course 2\nbad line");
    assert.equal(r.courses.length, 3);
    assert.deepEqual(r.courses[1].prereqs, ["302211", "302202"]);
    assert.equal(r.courses[2].credits, 2);
    assert.equal(r.errors.length, 1);
  });
});

describe("grade components", () => {
  const comps: GradeComponent[] = [
    { id: "q1", name: "q1", weight: 20, score: 15, max: 20 }, // 75%
    { id: "lab", name: "lab", weight: 20, score: 18, max: 20 }, // 90%
    { id: "f", name: "final", weight: 60, isFinal: true },
  ];
  test("standing", () => {
    const s = standing(comps);
    close(s.securedMark, 0.75 * 20 + 0.9 * 20); // 33
    assert.equal(s.remainingWeight, 60);
    close(s.maxPossibleMark, 93);
    close(s.currentAverage, 82.5);
    close(s.projectedMark, 33 + 0.825 * 60);
    assert.equal(s.weightsValid, true);
  });
  test("needed in the final for each letter", () => {
    const n = neededForEachLetter(comps);
    const d = n.find((x) => x.letter === "D")!; // min 50 → (50-33)/60 = 28.3%
    close(d.neededPct, ((50 - 33) / 60) * 100);
    const aPlus = n.find((x) => x.letter === "A+")!; // min 98 → 108% impossible
    assert.equal(aPlus.achievable, false);
    assert.equal(neededForMark(comps, 80), ((80 - 33) / 60) * 100);
  });
  test("already secured and nothing remaining", () => {
    const done: GradeComponent[] = [{ id: "a", name: "a", weight: 100, score: 70 }];
    const n = neededForEachLetter(done);
    assert.equal(n.find((x) => x.letter === "C+")!.alreadySecured, true);
    assert.equal(n.find((x) => x.letter === "B")!.achievable, false);
    assert.equal(neededForMark(done, 80), null);
  });
});

describe("transcript importer", () => {
  test("arabic digits and mixed formats", () => {
    assert.equal(normalizeDigits("٧٢"), "72");
    const rows = parseTranscriptText(`المقرر | الساعات | العلامة
301201 | تحليل هندسي (1) | 3 | ٧٢
Calculus (2)\t3\t88\tB+
601103 General Physics (1) 3 45
random header
`);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].code, "301201");
    assert.equal(rows[0].mark, 72);
    assert.equal(rows[0].credits, 3);
    assert.equal(rows[1].letter, "B+");
    assert.equal(rows[1].mark, 88);
    assert.equal(rows[2].mark, 45);
    assert.equal(rows[2].name.includes("General Physics"), true);
  });
});

describe("advisor cohort", () => {
  test("csv parsing with aliases", () => {
    const { students, errors } = parseStudentsCsv(SAMPLE_STUDENTS_CSV);
    assert.equal(errors.length, 0);
    assert.equal(students.length, 8);
    assert.equal(students[0].warnings, 2);
    assert.equal(students[0].gpaHours, 45);
  });
  test("assessment ranks critical first and flags correctly", () => {
    const { students } = parseStudentsCsv(SAMPLE_STUDENTS_CSV);
    const a = assessCohort(students, P);
    assert.equal(a[0].risk, "critical");
    const sam = a.find((x) => x.student.id === "2021005")!; // cgpa 0.95 < 1.0
    assert.ok(sam.flagsAr.some((f) => f.includes("حد الفصل")));
    const nour = a.find((x) => x.student.id === "2021006")!; // 99 credits, 1.79, warning 2
    assert.ok(nour.flagsAr.some((f) => f.includes("استثناء")));
    const reem = a.find((x) => x.student.id === "2021007")!;
    assert.equal(reem.risk, "low");
    assert.equal(reem.nextIfUnchanged, "good");
  });
});

describe("student mentor insights", () => {
  const base = {
    scale: DEFAULT_SCALE, policy: U, previousCgpa: 1.6, previousGpaHours: 45, completedCredits: 39, components: {}, plan: PLAN, semestersCount: 3, quickSemesters: 1, lastBackup: null,
  };
  test("empty data → single todo", () => {
    const r = mentor({ ...base, state: INITIAL_STATE, previousCgpa: 0, previousGpaHours: 0, semester: calculateSemester([]), courses: [], progress: {}, plan: null });
    assert.equal(r.insights.length, 1);
    assert.equal(r.insights[0].severity, "todo");
  });
  test("warning student gets status, required GPA, next-semester suggestion and graduation paths", () => {
    const courses = [newCourse({ id: "plan-601101", name: "تفاضل وتكامل (1)", credits: 3, grade: { kind: "mark", value: 48 } }), newCourse({ id: "plan-604101", name: "مهارات لغة إنكليزية (1)", credits: 3, grade: { kind: "mark", value: 68 } })];
    const r = mentor({ ...base, state: { ...INITIAL_STATE, status: "warning_2", warnings: 2, semesterIndex: 3 }, semester: calculateSemester(courses), courses, progress: { "401101": { status: "done", letter: "D" } } });
    const ids = r.insights.map((i) => i.id);
    assert.ok(ids.includes("status"));
    assert.ok(ids.some((i) => i.startsWith("fail-")), "failing course flagged");
    assert.ok(ids.some((i) => i.startsWith("border-")), "68 is 2 marks from C+ → borderline");
    assert.ok(ids.includes("next"), "next semester suggestion present");
    assert.equal(r.paths.length, 3);
    assert.ok(r.paths[0].semesters <= r.paths[2].semesters);
    assert.equal(r.insights[0].severity === "critical" || r.insights[0].severity === "warning", true, "sorted by severity");
    assert.equal(r.headline?.section, "status");
  });
  test("good standing student gets a green headline", () => {
    const r = mentor({ ...base, previousCgpa: 3.1, state: { ...INITIAL_STATE, status: "good", semesterIndex: 3 }, semester: calculateSemester([]), courses: [], progress: {} });
    assert.equal(r.headline?.severity, "good");
  });
});
