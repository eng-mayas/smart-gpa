import React, { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { makeT, Key } from "./i18n";
import { DashboardPage } from "./pages/DashboardPage";
import { SemesterPage } from "./pages/SemesterPage";
import { CumulativePage } from "./pages/CumulativePage";
import { PredictorPage } from "./pages/PredictorPage";
import { ExhaustionPage } from "./pages/ExhaustionPage";
import { WarningsPage } from "./pages/WarningsPage";
import { SemestersPage } from "./pages/SemestersPage";
import { RegulationsPage } from "./pages/RegulationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PlanPage } from "./pages/PlanPage";
import { ProgressPage } from "./pages/ProgressPage";
import { ImportPage } from "./pages/ImportPage";
import { AdvisorPage } from "./pages/AdvisorPage";
import { MentorPage } from "./pages/MentorPage";
import { Disclaimer } from "./components/common";
import { exportBackup } from "../state/backup";

const PRIMARY = ["dashboard", "cumulative", "semesters", "plan", "mentor"];
const MORE_GROUPS: { titleAr: string; titleEn: string; ids: string[] }[] = [
  { titleAr: "أدوات الحساب", titleEn: "Calculators", ids: ["semester", "progress", "predictor"] },
  { titleAr: "الإنذارات", titleEn: "Warnings", ids: ["exhaustion", "warnings", "regulations"] },
  { titleAr: "بياناتي", titleEn: "My data", ids: ["import", "settings"] },
  { titleAr: "للجامعات", titleEn: "For universities", ids: ["advisor"] },
];
const MORE_IDS = MORE_GROUPS.flatMap((g) => g.ids);
const SHORT: Record<string, { ar: string; en: string }> = { dashboard: { ar: "الرئيسية", en: "Home" }, semesters: { ar: "فصولي", en: "Semesters" }, cumulative: { ar: "التراكمي", en: "GPA" }, plan: { ar: "خطتي", en: "Plan" }, mentor: { ar: "المستشار", en: "Mentor" } };

const ROUTES: { id: string; key: Key; icon: string }[] = [
  { id: "dashboard", key: "nav_dashboard", icon: "▦" },
  { id: "semesters", key: "nav_history", icon: "🗓" },
  { id: "plan", key: "nav_plan", icon: "🎓" },
  { id: "mentor", key: "nav_mentor", icon: "🧭" },
  { id: "progress", key: "nav_progress", icon: "📈" },
  { id: "semester", key: "nav_semester", icon: "∑" },
  { id: "cumulative", key: "nav_cumulative", icon: "Σ" },
  { id: "predictor", key: "nav_predictor", icon: "◎" },
  { id: "exhaustion", key: "nav_exhaustion", icon: "🛟" },
  { id: "warnings", key: "nav_warnings", icon: "⚠" },
  { id: "import", key: "nav_import", icon: "📷" },
  { id: "regulations", key: "nav_regulations", icon: "§" },
  { id: "advisor", key: "nav_advisor", icon: "🏫" },
  { id: "settings", key: "nav_settings", icon: "⚙" },
];

function useHashRoute() {
  const get = () => (location.hash.replace(/^#\/?/, "") || "dashboard");
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const h = () => setRoute(get());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return [route, (r: string) => { location.hash = r; }] as const;
}

export function App() {
  const { state, dispatch } = useStore();
  const t = makeT(state.lang);
  const [route, go] = useHashRoute();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(() => MORE_IDS.includes(location.hash.replace(/^#\/?/, "")));
  useEffect(() => { if (MORE_IDS.includes(route)) setMore(true); }, [route]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [route]);

  const page = (() => {
    switch (route) {
      case "semester": return <SemesterPage />;
      case "cumulative": return <CumulativePage />;
      case "predictor": return <PredictorPage />;
      case "exhaustion": return <ExhaustionPage />;
      case "warnings": return <WarningsPage />;
      case "history":
      case "semesters": return <SemestersPage go={go} />;
      case "regulations": return <RegulationsPage />;
      case "settings": return <SettingsPage />;
      case "plan": return <PlanPage go={go} />;
      case "progress": return <ProgressPage go={go} />;
      case "import": return <ImportPage go={go} />;
      case "advisor": return <AdvisorPage />;
      case "mentor": return <MentorPage go={go} />;
      default: return <DashboardPage go={go} />;
    }
  })();

  return (
    <div className="app">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="logo"><img src="./atmata-logo.png" alt="Atmata Group" width={42} height={42} /></div>
          <div><b>{t("appName")}</b><small>{t("brandSub")}</small></div>
        </div>
        <nav className="nav stack" style={{ gap: 2 }}>
          {PRIMARY.map((id) => ROUTES.find((r) => r.id === id)!).map((r) => (
            <a key={r.id} href={`#${r.id}`} className={route === r.id ? "active" : ""}>
              <span className="ic">{r.icon}</span>{t(r.key)}
            </a>
          ))}
          <button className="nav-more" onClick={() => setMore(!more)} aria-expanded={more}>
            <span className="ic">{more ? "▾" : "▸"}</span>{state.lang === "ar" ? "المزيد" : "More"}
          </button>
          {more && MORE_GROUPS.map((g) => (
            <React.Fragment key={g.titleEn}>
              <div className="nav-group">{state.lang === "ar" ? g.titleAr : g.titleEn}</div>
              {g.ids.map((id) => ROUTES.find((r) => r.id === id)!).map((r) => (
                <a key={r.id} href={`#${r.id}`} className={`sub ${route === r.id ? "active" : ""}`}>
                  <span className="ic">{r.icon}</span>{t(r.key)}
                </a>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="spacer" />
        <div className="row" style={{ padding: "0 0.4rem" }}>
          <button className="btn sm" title="تنزيل نسخة احتياطية من بياناتك" onClick={() => { exportBackup(state); dispatch({ type: "set", patch: { lastBackup: new Date().toISOString() } }); }}>💾</button>
          <button className="btn sm" onClick={() => dispatch({ type: "set", patch: { theme: state.theme === "light" ? "dark" : "light" } })}>
            {state.theme === "light" ? "🌙 " + t("theme_dark") : "☀ " + t("theme_light")}
          </button>
          <button className="btn sm" onClick={() => dispatch({ type: "set", patch: { lang: state.lang === "ar" ? "en" : "ar" } })}>
            {state.lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </aside>
      <main className="main">
        <button className="btn menu-btn mb" onClick={() => setOpen(true)} aria-label="القائمة">☰ {t("appName")}</button>
        {page}
        <div className="credit">
          <img src="./atmata-logo.png" alt="Atmata Group" />
          <div>
            <div>{t("developedBy")} <b>Atmata Group</b> — أتمتة غروب</div>
            <div className="en">Automating Tomorrow</div>
          </div>
        </div>
        <Disclaimer text={t("disclaimer")} />
      </main>
      <nav className="bottom-nav" aria-label="التنقل">
        {PRIMARY.map((id) => ROUTES.find((r) => r.id === id)!).map((r) => (
          <a key={r.id} href={`#${r.id}`} className={route === r.id ? "active" : ""}>
            <span className="ic">{r.icon}</span><span>{SHORT[r.id]?.[state.lang] ?? t(r.key)}</span>
          </a>
        ))}
        <button onClick={() => { setMore(true); setOpen(true); }} className={MORE_IDS.includes(route) ? "active" : ""}>
          <span className="ic">☰</span><span>{state.lang === "ar" ? "المزيد" : "More"}</span>
        </button>
      </nav>
    </div>
  );
}
