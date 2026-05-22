import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MonitorPlay,
  Type,
  BarChart3,
  Lock,
  AlertTriangle,
  FileEdit,
  Eye,
} from "lucide-react";
import { useHome } from "@/contexts/HomeContext";
import { useAuth } from "@/contexts/AuthContext";
import IntroManager from "@/components/admin/home/IntroManager";
import StatsManager from "@/components/admin/home/StatsManager";
import HeroManager from "@/components/admin/home/HeroManager";

export default function HomepageManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "hero";
  const [activeSubTab, setActiveSubTab] = useState<"edit" | "preview">("edit");

  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const {
    slides,
    stats,
    settings,
    rejectedIntro,
    rejectedSlidesMap,
    rejectedStatsMap,
  } = useHome();

  const getTabStatus = (type: "hero" | "intro" | "stats") => {
    if (type === "hero")
      return {
        locked: slides.some((s) => s.is_locked),
        rejected: Object.keys(rejectedSlidesMap || {}).length > 0,
      };
    if (type === "intro")
      return {
        locked: settings?.is_locked,
        rejected: !!rejectedIntro,
      };
    if (type === "stats")
      return {
        locked: stats.some((s) => s.is_locked),
        rejected: Object.keys(rejectedStatsMap || {}).length > 0,
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
      {/* GLOBAL HEADER & ACTION MATRIX */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm top-0 z-30">
        <div>
          <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
            Homepage Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola identitas visual dan narasi utama beranda secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* VIEW MODE TOGGLE */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto shadow-inner">
            <button
              onClick={() => setActiveSubTab("edit")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeSubTab === "edit"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <FileEdit className="w-3.5 h-3.5" />
              <span>Input Form</span>
            </button>
            <button
              onClick={() => setActiveSubTab("preview")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeSubTab === "preview"
                  ? "bg-daw-green text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION DENGAN MATRIX INDICATOR */}
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

              <div className="flex gap-1.5 ml-2 items-center">
                {/* Indikator Revisi (Amber Pulse) */}
                {status.rejected && (
                  <span title="Revision Required">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  </span>
                )}

                {/* Indikator Gembok Berdasarkan Kasta */}
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

      {/* TAB CONTENT AREA */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        <div className={activeTab === "hero" ? "block" : "hidden"}>
          <HeroManager mode={activeSubTab} />
        </div>
        <div className={activeTab === "intro" ? "block" : "hidden"}>
          <IntroManager mode={activeSubTab} />
        </div>
        <div className={activeTab === "stats" ? "block" : "hidden"}>
          <StatsManager mode={activeSubTab} />
        </div>
      </div>
    </div>
  );
}
