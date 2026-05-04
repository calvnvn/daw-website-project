import {
  Map as MapIcon,
  Zap,
  Plus,
  Lock,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { type SectionData } from "@/contexts/BusinessContext";
import { memo } from "react";

interface SectionTabsProps {
  activeTab: string;
  sections: SectionData[];
  onChange: (id: string) => void;
  isEditing: boolean;
  onAddClick: () => void;
}

const ICON_MAP: Record<string, typeof MapIcon> = {
  energy: Zap,
  resources: MapIcon,
  infrastructure: MapIcon,
};

const getSectionIcon = (id: string) => {
  const key = Object.keys(ICON_MAP).find((k) => id.toLowerCase().includes(k));
  return ICON_MAP[key || "default"] || MapIcon;
};

const SectionTabs = memo(function SectionTabs({
  activeTab,
  sections,
  onChange,
  isEditing,
  onAddClick,
}: SectionTabsProps) {
  return (
    <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar top-0 z-30">
      {/* DYNAMIC DATABASE TABS */}
      {sections.map((section) => {
        const isActive = activeTab === section.id;
        const Icon = getSectionIcon(section.id);

        const isNeedsRevision = section.has_rejected;
        const isPending = section.is_locked && !isNeedsRevision;
        const isDeleting = isPending && section.lock_ticket?.includes("DEL");

        const statusStyles = isNeedsRevision
          ? "text-red-500 border-red-500 bg-red-50/30"
          : isDeleting
            ? "text-rose-500 border-rose-500 bg-rose-50/30 opacity-80"
            : isPending
              ? "text-blue-500 border-blue-500 bg-blue-50/30"
              : isActive
                ? "border-daw-green text-daw-green bg-green-50/30"
                : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50";

        return (
          <button
            key={section.id}
            onClick={() => onChange(section.id)}
            disabled={isEditing && !isActive}
            className={`flex items-center gap-2.5 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all whitespace-nowrap group relative
              ${statusStyles}
              ${isEditing && !isActive ? "opacity-30 cursor-not-allowed grayscale pointer-events-none" : "cursor-pointer"}
            `}>
            {/* Main Functional Icon */}
            <div className="relative">
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive
                    ? "text-current"
                    : "text-slate-300 group-hover:text-slate-500"
                }`}
              />
              {/* Micro-indicator: Titik kedip untuk draf update */}
              {isPending && !isDeleting && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>

            {/* Coret teks (line-through) jika sedang dalam antrean HAPUS */}
            <span className={`${isDeleting ? "line-through opacity-60" : ""}`}>
              {section.category}
            </span>

            {/* Logical Badges */}
            <div className="flex items-center gap-1 ml-1">
              {isDeleting ? (
                <div
                  className="p-0.5 bg-rose-100 text-rose-600 rounded shadow-sm"
                  title="Menunggu Penghapusan">
                  <Trash2 className="w-2.5 h-2.5" />
                </div>
              ) : isPending ? (
                <div
                  className="p-0.5 bg-blue-100 text-blue-600 rounded shadow-sm"
                  title="Menunggu Persetujuan">
                  <Lock className="w-2.5 h-2.5" />
                </div>
              ) : isNeedsRevision ? (
                <div
                  className="relative flex h-3 w-3 items-center justify-center"
                  title="Revisi Diperlukan">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <AlertCircle className="relative w-3 h-3 text-red-600" />
                </div>
              ) : null}
            </div>
          </button>
        );
      })}

      {/* ADMINISTRATIVE ACTIONS */}
      {isEditing && (
        <button
          onClick={onAddClick}
          // Tambahkan shrink-0 agar tombol tidak gepeng saat tab sangat banyak
          className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-daw-green hover:bg-green-50/50 transition-all group border-b-2 border-transparent animate-in slide-in-from-left-2 shrink-0"
          title="Tambah Sektor Bisnis Baru">
          <Plus className="w-4 h-4 transition-transform duration-300 group-hover:scale-125" />
          <span className="text-xs font-black uppercase tracking-widest hidden lg:block">
            New Sector
          </span>
        </button>
      )}

      {/* SYSTEM SETTINGS (Master Data) */}
      <div className="ml-auto pr-4 pb-2 shrink-0">
        <button
          onClick={() => onChange("categories")}
          disabled={isEditing && activeTab !== "categories"}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg transition-all
            ${
              activeTab === "categories"
                ? "bg-slate-900 text-white shadow-lg scale-105"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200"
            }
            ${isEditing && activeTab !== "categories" ? "opacity-30 cursor-not-allowed grayscale pointer-events-none" : ""}
          `}>
          <MapIcon className="w-3.5 h-3.5" /> Pin Config
        </button>
      </div>
    </div>
  );
});

export default SectionTabs;
