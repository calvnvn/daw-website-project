import { useState } from "react";
import {
  Target,
  History,
  BookOpen,
  Users,
  Lock,
  Unlock,
  ShieldAlert,
  Clock,
  Award,
  Eye,
  FileEdit,
} from "lucide-react";
import { useAbout } from "@/contexts/AboutContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import AboutInfoTab from "./tabs/AboutInfoTab";
import HistoryTab from "./tabs/HistoryTab";
import PhilosophyTab from "./tabs/PhilosophyTab";
import ManagementTab from "./tabs/ManagementTab";
import AchievementTab from "./tabs/AchievementTab";

export default function AboutUsManager() {
  const {
    aboutData,
    philosophyData,
    philosophyPillars,
    companyHistory,
    managementTeam,
    achievements,
    isLoading,
  } = useAbout();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "info" | "history" | "philosophy" | "management" | "achievement"
  >("info");
  const [activeSubTab, setActiveSubTab] = useState<"edit" | "preview">("edit");
  const [isEditing, setIsEditing] = useState(false);
  // const [hideDraftBanner, setHideDraftBanner] = useState(false);

  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  // EARLY RETURN GUARD
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-500 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-daw-green border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-sm tracking-wider uppercase">
            Memuat Konfigurasi...
          </p>
        </div>
      </div>
    );
  }

  // THE RADAR ENGINE (O(1) Status Matrix)
  const radar: Record<
    string,
    {
      isLocked: boolean;
      hasRejected: boolean;
      isSingleton: boolean;
      hasPartialLock: boolean;
    }
  > = {
    info: {
      isLocked: !!aboutData?.is_locked,
      hasRejected: !!aboutData?.hasRejected,
      isSingleton: true,
      hasPartialLock: false,
    },
    history: {
      isLocked: companyHistory.some((h) => h.is_locked),
      hasRejected: companyHistory.some((h) => h.hasRejected),
      isSingleton: true,
      hasPartialLock: false,
    },
    philosophy: {
      isLocked: !!philosophyData?.is_locked,
      hasRejected:
        !!philosophyData?.hasRejected ||
        philosophyPillars.some((p) => p.hasRejected),
      hasPartialLock: philosophyPillars.some((p) => p.is_locked),
      isSingleton: false,
    },
    management: {
      isLocked: false,
      hasRejected: managementTeam.some((m) => m.hasRejected),
      hasPartialLock: managementTeam.some((m) => m.is_locked),
      isSingleton: false,
    },
    achievement: {
      isLocked: achievements.some((a) => a.is_locked),
      hasRejected: achievements.some((a) => a.hasRejected),
      hasPartialLock: false,
      isSingleton: false,
    },
  };

  const currentTabState = radar[activeTab];
  const isGlobalLockActive =
    currentTabState.isSingleton && currentTabState.isLocked && isEditor;
  const isOverrideMode =
    isSuperadmin &&
    (currentTabState.isLocked || currentTabState.hasPartialLock);

  // ACTION: CLEAN DISCARD
  // const handleDiscardDraft = async () => {
  //   setHideDraftBanner(true);
  //   toast.info("Notifikasi penolakan disembunyikan dari layar.");
  // };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* A. AMBER BANNER: Sovereign Bypass */}
      {isOverrideMode && isEditing && (
        <div className="bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Aktif
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Anda sedang mengedit data yang sedang dalam antrean peninjauan.
              <span className="font-bold underline ml-1">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* B. BLUE BANNER: Locked UI Info */}
      {isGlobalLockActive && (
        <div className="bg-blue-50 border-l-4 border-l-blue-500 border-y border-r border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">
              Akses Dibatasi
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
              Data pada tab ini sedang ditinjau. Anda tidak dapat melakukan
              perubahan hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* GLOBAL HEADER & ACTION MATRIX */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              About Us Manager
            </h1>
            {(currentTabState.isLocked || currentTabState.hasPartialLock) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100 animate-pulse">
                <Clock className="w-3 h-3" /> PENDING
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola profil korporat, linimasa sejarah, dan struktur kepemimpinan
            DAW Group.
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

          <button
            onClick={() => {
              if (isGlobalLockActive) {
                return toast.error("Akses Dibatasi", {
                  description:
                    "Data pada tab ini sedang dalam antrean approval.",
                });
              }
              setIsEditing(!isEditing);
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
              isGlobalLockActive
                ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 ring-4 ring-amber-500/5 hover:bg-amber-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}>
            {isGlobalLockActive ? (
              <Lock className="w-4 h-4 text-slate-400" />
            ) : isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {isGlobalLockActive
                ? "Locked"
                : isOverrideMode && isEditing
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION & MICRO-INDICATORS */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {[
          {
            id: "info",
            label: "Company Info",
            icon: Target,
            state: radar.info,
          },
          {
            id: "history",
            label: "History",
            icon: History,
            state: radar.history,
          },
          {
            id: "philosophy",
            label: "Philosophy",
            icon: BookOpen,
            state: radar.philosophy,
          },
          {
            id: "management",
            label: "Management Team",
            icon: Users,
            state: radar.management,
          },
          {
            id: "achievement",
            label: "Achievements",
            icon: Award,
            state: radar.achievement,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-daw-green text-daw-green bg-green-50/30"
                : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}>
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            <div className="flex items-center gap-1 ml-1">
              {tab.state.hasRejected && (
                <span title="Revisi Diperlukan">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white" />
                </span>
              )}
              {/* Cek gembok baik yg Singleton maupun Partial */}
              {(tab.state.isLocked || tab.state.hasPartialLock) &&
                !tab.state.hasRejected && (
                  <span title="Pending Approval">
                    <Lock className="w-3 h-3 text-blue-500" />
                  </span>
                )}
            </div>
          </button>
        ))}
      </div>

      {/* DYNAMIC TAB RENDERER */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500">
        {activeTab === "info" && (
          <AboutInfoTab
            mode={activeSubTab}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            isEditor={isEditor}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab
            mode={activeSubTab}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            isEditor={isEditor}
          />
        )}
        {activeTab === "philosophy" && (
          <PhilosophyTab
            mode={activeSubTab}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            isEditor={isEditor}
          />
        )}
        {activeTab === "management" && (
          <ManagementTab
            mode={activeSubTab}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            isEditor={isEditor}
          />
        )}
        {activeTab === "achievement" && (
          <AchievementTab
            mode={activeSubTab}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            isEditor={isEditor}
          />
        )}
      </div>
    </div>
  );
}
