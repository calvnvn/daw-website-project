import { useState } from "react";
import { MonitorPlay, Type, BarChart3 } from "lucide-react";
import IntroManager from "@/components/IntroManager";
import StatsManager from "@/components/StatsManager";
import HeroManager from "@/components/HeroManager";

export default function HomepageManager() {
  const [activeTab, setActiveTab] = useState<"hero" | "intro" | "stats">(
    "hero",
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <h1 className="text-2xl font-serif font-bold text-slate-900">
          Homepage Manager
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage hero banner, welcome text, and impact statistics modularly.
        </p>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        <button
          onClick={() => setActiveTab("hero")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "hero"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <MonitorPlay className="w-4 h-4" /> Hero Carousel
        </button>
        <button
          onClick={() => setActiveTab("intro")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "intro"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Type className="w-4 h-4" /> Welcome Intro
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "stats"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Impact Statistics
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        {activeTab === "hero" && <HeroManager />}
        {activeTab === "intro" && <IntroManager />}
        {activeTab === "stats" && <StatsManager />}
      </div>
    </div>
  );
}
