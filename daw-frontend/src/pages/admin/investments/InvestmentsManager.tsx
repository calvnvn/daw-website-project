/**
 * InvestmentsManager — Orchestrator Component
 */
import {
  Save,
  Lock,
  Unlock,
  Building,
  Type,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Send,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useInvestmentManager } from "./useInvestmentManager";
import SettingsTab from "./SettingsTab";
import CompaniesTab from "./CompaniesTab";

export default function InvestmentsManager() {
  const mgr = useInvestmentManager();

  const {
    isSuperadmin,
    activeTab,
    setActiveTab,
    isEditing,
    setIsEditing,
    isSaving,
    isSettingsOverrideMode,
    currentLockState,
    lockStyles,
    pageContent,
    setPageContent,
    rejectedSettings,
    hideDraftBanner,
    localCompanies,
    sortedCompanies,
    rejectedAffiliates,
    localCategories,
    setLocalCategories,
    showNewCategoryForm,
    setShowNewCategoryForm,
    newCategoryData,
    setNewCategoryData,
    editingCategoryId,
    setEditingCategoryId,
    handleSave,
    handleRestoreSettingsDraft,
    handleDiscardDraft,
    handleRestoreAffiliateDraft,
    handleDiscardAffiliateDraft,
    addCompany,
    removeCompany,
    updateCompany,
    handleLogoChange,
    refreshData,
    terjemahanHeadline, setTerjemahanHeadline,
    terjemahanBody, setTerjemahanBody,
    terjemahanIntro, setTerjemahanIntro,
  } = mgr;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* AMBER BANNER: Sovereign Bypass (Khusus Admin) */}
      {isSettingsOverrideMode && activeTab === "content" && (
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
              <span className="font-bold underline">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* BLUE BANNER: Locked UI (Khusus Editor) */}
      {currentLockState && (
        <div className="bg-blue-50 border-l-4 border-l-blue-500 border-y border-r border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">
              Akses Dibatasi
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
              Data pada halaman ini sedang ditinjau. Anda tidak dapat melakukan
              perubahan hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* RED BANNER: Recovery Banner (Rejection Feedback) */}
      {rejectedSettings && activeTab === "content" && !hideDraftBanner && (
        <div className="bg-red-50 border-l-4 border-l-red-500 border-y border-r border-red-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-5 flex gap-4 items-start">
            <div className="bg-red-100 p-2.5 rounded-lg h-fit shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                ⚠️ Revisi Ditolak: Catatan Peninjau
              </h4>
              <p className="text-xs text-red-800 leading-relaxed font-medium bg-white/60 p-3 rounded-md border border-red-200/50 shadow-inner">
                "
                {rejectedSettings.rejection_reason ||
                  "Silakan perbaiki data sesuai arahan."}
                "
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleRestoreSettingsDraft}
                  disabled={!isEditing}
                  title={
                    !isEditing
                      ? "Buka mode edit untuk memulihkan data"
                      : "Pulihkan draf yang ditolak"
                  }
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                  />
                  PULIHKAN DATA
                </button>
                <button
                  onClick={handleDiscardDraft}
                  className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <X className="w-3.5 h-3.5" />
                  ABAIKAN NOTIFIKASI
                </button>
                {!isEditing && (
                  <p className="text-[10px] text-red-500 font-medium italic animate-pulse ml-2">
                    * Aktifkan "Editing Mode" untuk memulihkan.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & ACTION MATRIX */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Investments Manager
            </h1>
            {localCompanies.some((c) => c.is_locked) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100 animate-pulse">
                <Clock className="w-3 h-3" /> PENDING
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola ekosistem investasi, konten teks promosi, dan logo perusahaan
            afiliasi secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              if (currentLockState)
                return toast.error("Akses Dibatasi", {
                  description: "Data teks sedang dalam antrean approval.",
                });
              setIsEditing(!isEditing);
            }}
            disabled={isSaving || currentLockState}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
              currentLockState
                ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 ring-4 ring-amber-500/5 hover:bg-amber-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}>
            {currentLockState ? (
              <Lock className="w-4 h-4 text-slate-400" />
            ) : isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {currentLockState
                ? "Locked"
                : isSettingsOverrideMode && isEditing && activeTab === "content"
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              !isEditing ||
              currentLockState ||
              (activeTab === "companies" &&
                !localCompanies.some((c) => c.isDirty || c.isNew))
            }
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : currentLockState
                  ? "bg-slate-200 text-slate-500"
                  : isSuperadmin
                    ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            }`}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? "Memproses..."
                : isSuperadmin
                  ? "Publish Live"
                  : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        <button
          onClick={() => !isSaving && setActiveTab("content")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            isSaving ? "cursor-wait opacity-80" : ""
          } ${activeTab === "content" ? "border-daw-green text-daw-green bg-green-50/30" : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}>
          <Type className="w-4 h-4" />
          <span>Page Content</span>
          <div className="flex items-center gap-1 ml-1">
            {rejectedSettings && (
              <span title="Revisi Diperlukan">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white" />
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => !isSaving && setActiveTab("companies")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            isSaving ? "cursor-wait opacity-80" : ""
          } ${activeTab === "companies" ? "border-daw-green text-daw-green bg-green-50/30" : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}>
          <Building className="w-4 h-4" />
          <span>Affiliated Companies</span>
          <div className="flex items-center gap-1 ml-1">
            {localCompanies.some((c) => c.has_rejected) && (
              <span title="Revisi Diperlukan">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white" />
              </span>
            )}
            {localCompanies.some((c) => c.is_locked && !c.has_rejected) && (
              <span title="Pending Approval">
                <Lock className="w-3 h-3 text-blue-500" />
              </span>
            )}
          </div>
        </button>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500">
        {activeTab === "content" && (
          <SettingsTab
            pageContent={pageContent}
            setPageContent={setPageContent}
            isEditing={isEditing}
            isSuperadmin={isSuperadmin}
            currentLockState={currentLockState}
            lockStyles={lockStyles}
            settingsIsLocked={
              mgr.isSettingsLockedForEditor || mgr.isSettingsOverrideMode
            }
            terjemahanHeadline={terjemahanHeadline}
            terjemahanBody={terjemahanBody}
            terjemahanIntro={terjemahanIntro}
            onTerjemahanChange={(field, value) => {
              if (field === "teaserHeadline") setTerjemahanHeadline(value);
              if (field === "teaserBody") setTerjemahanBody(value);
              if (field === "sectionIntro") setTerjemahanIntro(value);
            }}
          />
        )}

        {activeTab === "companies" && (
          <CompaniesTab
            isEditing={isEditing}
            isSaving={isSaving}
            isSuperadmin={isSuperadmin}
            sortedCompanies={sortedCompanies}
            localCategories={localCategories}
            setLocalCategories={setLocalCategories}
            showNewCategoryForm={showNewCategoryForm}
            setShowNewCategoryForm={setShowNewCategoryForm}
            newCategoryData={newCategoryData}
            setNewCategoryData={setNewCategoryData}
            editingCategoryId={editingCategoryId}
            setEditingCategoryId={setEditingCategoryId}
            rejectedAffiliates={rejectedAffiliates}
            addCompany={addCompany}
            removeCompany={removeCompany}
            updateCompany={updateCompany}
            handleLogoChange={handleLogoChange}
            handleRestoreAffiliateDraft={handleRestoreAffiliateDraft}
            handleDiscardAffiliateDraft={handleDiscardAffiliateDraft}
            refreshData={refreshData}
          />
        )}
      </div>
    </div>
  );
}
