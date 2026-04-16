import { Map as MapIcon, Zap, Plus, Lock, AlertCircle } from "lucide-react";
import { type SectionData } from "@/contexts/BusinessContext";

interface SectionTabsProps {
  activeTab: string;
  sections: SectionData[];
  onChange: (id: string) => void;
  isEditing: boolean;
  onAddClick: () => void;
}

/**
 * Helper: Icon Mapper untuk skalabilitas
 */
const getSectionIcon = (id: string) => {
  const iconMap: Record<string, typeof MapIcon> = {
    energy: Zap,
    resources: MapIcon,
    // Tambahkan mapping lain di sini
  };

  // Mencari key yang terkandung dalam ID
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
    <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar sticky left-0 right-0">
      {/* RENDER TAB DARI DATABASE */}
      {sections.map((section) => {
        const isActive = activeTab === section.id;
        const Icon = getSectionIcon(section.id);

        return (
          <button
            key={section.id}
            onClick={() => onChange(section.id)}
            disabled={isEditing && !isActive} // Prevent switching while editing another tab
            className={`flex items-center gap-2.5 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all whitespace-nowrap group relative
              ${
                isActive
                  ? "border-daw-green text-daw-green bg-green-50/30"
                  : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }
              ${isEditing && !isActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}>
            {/* 1. MAIN ICON */}
            <Icon
              className={`w-4 h-4 ${isActive ? "text-daw-green" : "text-slate-300 group-hover:text-slate-500"}`}
            />

            <span>{section.category}</span>

            {/* 2. BADGE: LOCKED (PENDING) */}
            {section.is_locked && (
              <div
                className="ml-1 p-0.5 bg-blue-100 text-blue-600 rounded-md shadow-sm"
                title="Pending Approval">
                <Lock className="w-2.5 h-2.5" />
              </div>
            )}

            {/* 3. BADGE: REJECTED (REVISION REQUIRED) */}
            {section.has_rejected && (
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-sm border border-white"></span>
                <div className="sr-only">Needs Revision</div>
              </div>
            )}
          </button>
        );
      })}

      {/* ACTION: TAMBAH SEKTOR BARU */}
      {isEditing && (
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-daw-green hover:bg-slate-50 transition-colors group border-b-2 border-transparent"
          title="Create New Section">
          <Plus className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-sm font-bold uppercase tracking-wider hidden lg:block">
            Tambah Sektor
          </span>
        </button>
      )}

      {/* SYSTEM TAB: PENGATURAN PIN */}
      <div className="ml-auto pr-4 pb-2">
        <button
          onClick={() => onChange("categories")}
          disabled={isEditing && activeTab !== "categories"}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg transition-all
            ${
              activeTab === "categories"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }
            ${isEditing && activeTab !== "categories" ? "opacity-50 cursor-not-allowed" : ""}
          `}>
          <MapIcon className="w-3.5 h-3.5" /> Pengaturan Peta
        </button>
      </div>
    </div>
  );
}
