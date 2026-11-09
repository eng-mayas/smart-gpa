export type Lang = "ar" | "en";

const dict = {
  appName: { ar: "Smart GPA", en: "Smart GPA" },
  tagline: { ar: "منصة التخطيط الأكاديمي الذكية", en: "Academic planning platform" },
  nav_dashboard: { ar: "الرئيسية", en: "Home" },
  nav_semester: { ar: "حساب المعدل الفصلي", en: "Semester GPA" },
  nav_cumulative: { ar: "حساب المعدل التراكمي", en: "Cumulative GPA" },
  nav_predictor: { ar: "توقع المعدل", en: "GPA Predictor" },
  nav_exhaustion: { ar: "كيف أتجنب الاستنفاذ؟", en: "Avoid Exhaustion" },
  nav_warnings: { ar: "الإنذارات الأكاديمية", en: "Academic Warnings" },
  nav_history: { ar: "فصولي", en: "My Semesters" },
  nav_regulations: { ar: "الأنظمة الجامعية", en: "University Regulations" },
  nav_mentor: { ar: "المستشار الأكاديمي", en: "Academic Mentor" },
  nav_plan: { ar: "الخطة الدراسية", en: "Study Plan" },
  nav_progress: { ar: "علاماتي خلال الفصل", en: "In-Semester Grades" },
  nav_import: { ar: "استيراد كشف العلامات", en: "Import Transcript" },
  nav_advisor: { ar: "لوحة المرشد الأكاديمي", en: "Advisor Dashboard" },
  nav_settings: { ar: "الإعدادات", en: "Settings" },
  developedBy: { ar: "تم تطوير التطبيق بواسطة", en: "Developed by" },
  brandSub: { ar: "من Atmata Group", en: "by Atmata Group" },
  theme_light: { ar: "فاتح", en: "Light" },
  theme_dark: { ar: "داكن", en: "Dark" },
  disclaimer: {
    ar: "هذا التطبيق أداة مساعدة على اتخاذ القرار. جميع القواعد الأكاديمية قابلة للتهيئة وخاضعة للتحقق من اللوائح الرسمية، ولا يُغني التطبيق عن القرارات الأكاديمية الرسمية للجامعة.",
    en: "This app is a decision-support tool. All academic rules are configurable and subject to verification against official regulations; it does not replace official university decisions.",
  },
} as const;

export type Key = keyof typeof dict;

export function makeT(lang: Lang) {
  return (k: Key) => dict[k][lang];
}
