import { Map as MapIcon, Zap, Plus, Lock } from "lucide-react";
import { type SectionData } from "@/contexts/BusinessContext";

interface SectionTabsProps {
  activeTab: string;
  sections: SectionData[];
  onChange: (id: string) => void;
  isEditing: boolean;
  onAddClick: () => void;
}

const getSectionIcon = (id: string) => {
  const iconMap: Record<string, typeof MapIcon> = {
    energy: Zap,
    resources: MapIcon,
    infrastructure: MapIcon,
  };

  const key = Object.keys(iconMap).find((k) => id.toLowerCase().includes(k));
  return iconMap[key || "default"] || MapIcon;
};

export default function SectionTabs({
  activeTab,
  sections,
  onChange,
  isEditing,
  onAddClick,
}: SectionTabsProps) {
  return (
    <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar sticky left-0 right-0 z-10">
      {/* DYNAMIC DATABASE TABS */}
      {sections.map((section) => {
        const isActive = activeTab === section.id;
        const Icon = getSectionIcon(section.id);
        const isLocked = section.is_locked;
        const isNeedsRevision = section.has_rejected;

        return (
          <button
            key={section.id}
            onClick={() => onChange(section.id)}
            disabled={isEditing && !isActive}
            className={`flex items-center gap-2.5 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all whitespace-nowrap group relative
              ${
                isActive
                  ? "border-daw-green text-daw-green bg-green-50/30"
                  : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }
              ${isEditing && !isActive ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"}
            `}>
            {/*  Main Functional Icon */}
            <Icon
              className={`w-4 h-4 transition-colors ${isActive ? "text-daw-green" : "text-slate-300 group-hover:text-slate-500"}`}
            />

            <span>{section.category}</span>

            {/* Badge: Pending Approval (Blueprint II.2) */}
            {isLocked && (
              <div
                className="ml-1 p-0.5 bg-blue-100 text-blue-600 rounded-md shadow-sm animate-in fade-in zoom-in-75"
                title="Menunggu Persetujuan (Locked)">
                <Lock className="w-2.5 h-2.5" />
              </div>
            )}

            {/* Badge: Rejection Radar (Blueprint III.2) */}
            {isNeedsRevision && (
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 shadow-sm border border-white"></span>
                <div className="sr-only">Revision Required</div>
              </div>
            )}
          </button>
        );
      })}

      {/* ADMINISTRATIVE ACTIONS */}
      {isEditing && (
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-daw-green hover:bg-slate-50 transition-colors group border-b-2 border-transparent animate-in slide-in-from-left-2"
          title="Tambah Sektor Bisnis Baru">
          <Plus className="w-4 h-4 transition-transform duration-300 group-hover:scale-125" />
          <span className="text-sm font-bold uppercase tracking-wider hidden lg:block">
            Tambah Sektor
          </span>
        </button>
      )}

      {/* SYSTEM SETTINGS (Master Data) */}
      <div className="ml-auto pr-4 pb-2">
        <button
          onClick={() => onChange("categories")}
          disabled={isEditing && activeTab !== "categories"}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg transition-all
            ${
              activeTab === "categories"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200"
            }
            ${isEditing && activeTab !== "categories" ? "opacity-30 cursor-not-allowed grayscale" : ""}
          `}>
          <MapIcon className="w-3.5 h-3.5" /> Pengaturan Pin
        </button>
      </div>
    </div>
  );
}
