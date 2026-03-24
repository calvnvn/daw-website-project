import { useState } from "react";
import { FileText, Map } from "lucide-react";
import NavigationBuilder from "./content/NavigationBuilder";
import PageBuilder from "./content/PageBuilder";

export default function ContentManager() {
  // --- MASTER TAB STATE ---
  const [activeTab, setActiveTab] = useState<"pages" | "menus">("pages");

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* --- MASTER HEADER & TABS --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-900">
                Content Manager
              </h1>
              <p className="text-sm text-slate-500">
                Kelola halaman dan struktur navigasi situs web.
              </p>
            </div>
          </div>

          {/* Tab Navigation Hub */}
          <div className="flex p-1.5 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab("pages")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                activeTab === "pages"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              }`}
            >
              <FileText className="w-4 h-4" /> Pages
            </button>
            <button
              onClick={() => setActiveTab("menus")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                activeTab === "menus"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              }`}
            >
              <Map className="w-4 h-4" /> Navigation
            </button>
          </div>
        </div>
      </div>

      {/* --- DYNAMIC RENDERER --- */}
      <div className="min-h-[600px] relative">
        {/* Tab Pages: Tetap terpasang di memori, hanya diatur visibilitasnya */}
        <div
          className={
            activeTab === "pages"
              ? "block animate-in fade-in duration-500"
              : "hidden"
          }
        >
          <PageBuilder />
        </div>
        {/* Tab Navigation: Tetap terpasang di memori */}
        <div
          className={
            activeTab === "menus"
              ? "block animate-in fade-in duration-500"
              : "hidden"
          }
        >
          <NavigationBuilder />
        </div>
      </div>
    </div>
  );
}
