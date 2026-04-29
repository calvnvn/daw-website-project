import { useSearchParams } from "react-router-dom";
import { FileText, Map } from "lucide-react";
import NavigationBuilder from "./builder/NavigationBuilder";
import PageBuilder from "./builder/PageBuilder";

export default function ContentManager() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") === "menus" ? "menus" : "pages";

  const setActiveTab = (tab: "pages" | "menus") => {
    setSearchParams({ tab });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* MASTER HEADER & TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900">
              Content Manager
            </h1>
            <p className="text-sm text-slate-500">
              Kelola halaman dan struktur navigasi situs web.
            </p>
          </div>

          {/* Tab Navigation Hub */}
          <div className="flex p-1.5 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab("pages")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                activeTab === "pages"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              }`}>
              <FileText className="w-4 h-4" /> Pages
            </button>
            <button
              onClick={() => setActiveTab("menus")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                activeTab === "menus"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
              }`}>
              <Map className="w-4 h-4" /> Navigation
            </button>
          </div>
        </div>
      </div>

      {/* DYNAMIC RENDERER */}
      <div className="min-h-[600px] relative">
        <div className={activeTab === "pages" ? "block" : "hidden"}>
          <PageBuilder />
        </div>
        <div className={activeTab === "menus" ? "block" : "hidden"}>
          <NavigationBuilder />
        </div>
      </div>
    </div>
  );
}
