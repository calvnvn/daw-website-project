import { Map as MapIcon, Zap, Plus, Lock } from "lucide-react";
import { type SectionData } from "@/contexts/BusinessContext";

interface SectionTabsProps {
  activeTab: string;
  sections: SectionData[];
  onChange: (id: string) => void;
  isEditing: boolean;
  onAddClick: () => void;
}

export default function SectionTabs({
  activeTab,
  sections,
  onChange,
  isEditing,
  onAddClick,
}: SectionTabsProps) {
  return (
    <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
      {/* RENDER TAB DARI DATABASE */}
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onChange(section.id)}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === section.id
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          {/* LOGIC ICON: Menampilkan Zap jika ID mengandung kata 'energy' */}
          {section.id.includes("energy") ? (
            <Zap className="w-4 h-4" />
          ) : (
            <MapIcon className="w-4 h-4" />
          )}
          {section.category}
        </button>
      ))}

      {/* ACTION: TAMBAH SEKTOR BARU (Hanya muncul saat Editing Mode) */}
      {isEditing && (
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-daw-green hover:bg-slate-50 transition-colors group border-b-2 border-transparent"
          title="Create New Section"
        >
          <Plus className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-sm font-bold uppercase tracking-wider hidden md:block">
            Tambah Sektor
          </span>
        </button>
      )}

      {/* SYSTEM TAB: FIXED DI PALING KANAN */}
      <div className="ml-auto pr-4 pb-2">
        <button
          onClick={() => onChange("categories")}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors ${
            activeTab === "categories"
              ? "bg-slate-100 text-slate-900 border border-slate-200"
              : "text-slate-400 hover:bg-slate-50"
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> Pengaturan Pin Peta
        </button>
      </div>
    </div>
  );
}
