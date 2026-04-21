import { useSearchParams } from "react-router-dom";
import {
  MonitorPlay,
  Type,
  BarChart3,
  Lock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useHome } from "@/contexts/HomeContext";
import { useAuth } from "@/contexts/AuthContext";
import IntroManager from "@/components/IntroManager";
import StatsManager from "@/components/StatsManager";
import HeroManager from "@/components/HeroManager";

export default function HomepageManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "hero";

  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const { slides, stats, settings, rejectedIntro } = useHome();

  const getTabStatus = (type: "hero" | "intro" | "stats") => {
    if (type === "hero")
      return {
        locked: slides.some((s) => s.is_locked),
        rejected: slides.some((s) => s.has_rejected),
      };
    if (type === "intro")
      return {
        locked: settings?.is_locked,
        // Intro menggunakan rejectedIntro snapshot dari Context v1.2
        rejected: !!rejectedIntro || settings?.has_rejected,
      };
    if (type === "stats")
      return {
        locked: stats.some((s) => s.is_locked),
        rejected: stats.some((s) => s.has_rejected),
      };
    return { locked: false, rejected: false };
  };

  const tabs = [
    { id: "hero", label: "Hero Carousel", icon: MonitorPlay },
    { id: "intro", label: "Welcome Intro", icon: Type },
    { id: "stats", label: "Impact Statistics", icon: BarChart3 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Homepage Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola identitas visual dan narasi utama beranda secara terpusat.
          </p>
        </div>
        {isSuperadmin && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-700 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3" /> Sovereign Access
          </div>
        )}
      </div>

      {/* --- TABS NAVIGATION DENGAN MATRIX INDICATOR --- */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {tabs.map((tab) => {
          const status = getTabStatus(tab.id as any);
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`group relative flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-daw-green text-daw-green"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}>
              <tab.icon
                className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`}
              />
              {tab.label}

              {/* 🚀 MATRIX TAB BADGE (Visual Authority) */}
              <div className="flex gap-1.5 ml-2 items-center">
                {/* 1. Indikator Revisi (Amber Pulse) */}
                {status.rejected && (
                  <span title="Revision Required">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  </span>
                )}

                {/* 2. Indikator Gembok Berdasarkan Kasta */}
                {status.locked && (
                  <span
                    title={
                      isSuperadmin
                        ? "Override Mode Available"
                        : "Pending Approval"
                    }>
                    {isSuperadmin ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-blue-500 opacity-80" />
                    )}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        <div className={activeTab === "hero" ? "block" : "hidden"}>
          <HeroManager />
        </div>
        <div className={activeTab === "intro" ? "block" : "hidden"}>
          <IntroManager />
        </div>
        <div className={activeTab === "stats" ? "block" : "hidden"}>
          <StatsManager />
        </div>
      </div>
    </div>
  );
}
