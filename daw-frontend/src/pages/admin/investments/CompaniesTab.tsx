/**
 * CompaniesTab — Tab 2 of InvestmentsManager
 * Renders nested category accordions with affiliated company cards inside.
 */
import React, { useMemo } from "react";
import * as LucideIcons from "lucide-react";
import {
  Save, Plus, Trash2, Building, AlertTriangle, RotateCcw,
  X, ChevronDown, FolderPlus, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { CATEGORY_ICONS } from "./InvestmentConstants";
import type { LocalAffiliate, LocalCategory } from "./InvestmentConstants";
import ImageAdjustmentModal from "@/components/admin/ImageAdjustmentModal";

// ==========================================
// LOGO PREVIEWER (Memoized sub-component)
// ==========================================

const LogoPreviewer = React.memo(
  ({
    file, savedUrl, isEditing, onRemove,
  }: {
    file?: File | null;
    savedUrl: string | null;
    isEditing: boolean;
    onRemove: () => void;
  }) => {
    const previewUrl = useMemo(() => {
      if (file) return URL.createObjectURL(file);
      return getCleanImageUrl(savedUrl);
    }, [file, savedUrl]);

    return (
      <div
        className={`relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 overflow-hidden transition-colors ${
          isEditing
            ? "border-slate-300 bg-white hover:border-daw-green cursor-pointer group/preview"
            : "border-slate-200 bg-slate-100/50 cursor-not-allowed"
        }`}>
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            {isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="absolute top-1 right-1 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-md opacity-0 group-hover/preview:opacity-100 transition-opacity"
                title="Hapus Logo">
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-1.5 animate-in fade-in">
            <LucideIcons.Image
              className={`w-6 h-6 ${isEditing ? "text-daw-green" : "text-slate-400"}`}
            />
            <span
              className={`text-[9px] font-medium leading-tight ${isEditing ? "text-slate-700" : "text-slate-400"}`}>
              Upload Logo
            </span>
          </div>
        )}
      </div>
    );
  },
);
LogoPreviewer.displayName = "LogoPreviewer";

// ==========================================
// MAIN COMPONENT
// ==========================================

interface CompaniesTabProps {
  isEditing: boolean;
  isSaving: boolean;
  isSuperadmin: boolean;
  sortedCompanies: LocalAffiliate[];
  localCategories: LocalCategory[];
  setLocalCategories: React.Dispatch<React.SetStateAction<LocalCategory[]>>;
  showNewCategoryForm: boolean;
  setShowNewCategoryForm: React.Dispatch<React.SetStateAction<boolean>>;
  newCategoryData: { name: string; description: string; icon: string };
  setNewCategoryData: React.Dispatch<React.SetStateAction<{ name: string; description: string; icon: string }>>;
  editingCategoryId: number | string | null;
  setEditingCategoryId: React.Dispatch<React.SetStateAction<number | string | null>>;
  rejectedAffiliates: Record<string, any>;
  addCompany: (categoryId: number | string) => void;
  removeCompany: (id: number | string) => void;
  updateCompany: (id: number | string, field: keyof LocalAffiliate, value: any) => void;
  handleLogoChange: (id: number | string, file: File) => void;
  handleRestoreAffiliateDraft: (companyId: string | number) => void;
  handleDiscardAffiliateDraft: (companyId: string | number) => void;
  refreshData: () => Promise<void>;
}

export default function CompaniesTab({
  isEditing, isSaving, isSuperadmin,
  sortedCompanies, localCategories, setLocalCategories,
  showNewCategoryForm, setShowNewCategoryForm,
  newCategoryData, setNewCategoryData,
  editingCategoryId, setEditingCategoryId,
  rejectedAffiliates,
  addCompany, removeCompany, updateCompany, handleLogoChange,
  handleRestoreAffiliateDraft, handleDiscardAffiliateDraft,
  refreshData,
}: CompaniesTabProps) {
  const [currentCropFile, setCurrentCropFile] = React.useState<{file: File, companyId: string | number} | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-daw-green" /> Network Ecosystem
          </h3>
          <p className="text-sm text-slate-500 mt-1">Kelola kategori investasi dan perusahaan afiliasi secara hierarkis.</p>
        </div>
        {isEditing && (
          <button onClick={() => setShowNewCategoryForm(!showNewCategoryForm)} disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white disabled:opacity-50 text-daw-green rounded-lg text-sm font-bold transition-colors">
            <FolderPlus className="w-4 h-4" /> Tambah Kategori
          </button>
        )}
      </div>

      {/* NEW CATEGORY FORM */}
      {showNewCategoryForm && isEditing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3 animate-in slide-in-from-top-2">
          <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tight">Kategori Baru</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Nama Kategori (wajib)" value={newCategoryData.name}
              onChange={(e) => setNewCategoryData(p => ({ ...p, name: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-400/30 outline-none" />
            <input type="text" placeholder="Deskripsi singkat" value={newCategoryData.description}
              onChange={(e) => setNewCategoryData(p => ({ ...p, description: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-400/30 outline-none" />
          </div>

          <div className="bg-white/60 p-3 rounded-lg border border-emerald-200/60">
            <label className="text-[10px] font-black text-emerald-800/70 uppercase tracking-widest mb-2 block">Pilih Ikon Kategori</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-2">
              {CATEGORY_ICONS.map((iconName) => {
                const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Briefcase;
                return (
                  <button key={iconName} type="button" title={iconName}
                    onClick={() => setNewCategoryData(p => ({ ...p, icon: iconName }))}
                    className={`p-2 rounded-lg transition-all ${newCategoryData.icon === iconName ? 'bg-emerald-500 text-white shadow-md scale-110' : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={!newCategoryData.name.trim() || isSaving}
              onClick={async () => {
                const tid = toast.loading("Membuat kategori...");
                try {
                  await api.post("/investments/categories", newCategoryData);
                  toast.success("Kategori berhasil dibuat!", { id: tid });
                  setNewCategoryData({ name: "", description: "", icon: "Briefcase" });
                  setShowNewCategoryForm(false);
                  await refreshData();
                } catch (err: any) { toast.error(err.response?.data?.message || "Gagal membuat kategori", { id: tid }); }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-lg transition-colors">
              Simpan Kategori
            </button>
            <button onClick={() => setShowNewCategoryForm(false)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* CATEGORY ACCORDION SECTIONS */}
      {localCategories.map((cat) => {
        const companiesInCat = sortedCompanies.filter(c => c.category_id === cat.id);
        const isEditingThisCat = editingCategoryId === cat.id;

        return (
          <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* CATEGORY HEADER */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
              onClick={() => setLocalCategories(prev => prev.map(c => c.id === cat.id ? { ...c, isCollapsed: !c.isCollapsed } : c))}>
              <div className="flex items-center gap-3">
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${cat.isCollapsed ? "-rotate-90" : ""}`} />
                {(() => {
                  const CatIcon = (LucideIcons as any)[cat.icon] || LucideIcons.Briefcase;
                  return <CatIcon className="w-4 h-4 text-slate-400" />;
                })()}
                <div className="flex-1">
                  {isEditingThisCat ? (
                    <div className="flex flex-col gap-3 w-full" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="text" value={cat.name} autoFocus
                          onChange={e => setLocalCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c))}
                          className="px-3 py-1.5 text-sm font-bold border border-daw-green rounded-md bg-white outline-none w-48 shadow-inner focus:ring-2 focus:ring-daw-green/20" />
                        <input type="text" value={cat.description} placeholder="Deskripsi opsional..."
                          onChange={e => setLocalCategories(prev => prev.map(c => c.id === cat.id ? { ...c, description: e.target.value } : c))}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white outline-none w-64 focus:border-daw-green" />

                        <div className="flex gap-2 ml-auto">
                          <button className="px-4 py-1.5 bg-daw-green hover:bg-emerald-600 text-white text-xs font-bold rounded-md shadow-sm transition-colors"
                            onClick={async () => {
                              const tid = toast.loading("Memperbarui...");
                              try {
                                await api.put(`/investments/categories/${cat.id}`, { name: cat.name, description: cat.description, icon: cat.icon });
                                toast.success("Kategori diperbarui!", { id: tid });
                                setEditingCategoryId(null);
                                await refreshData();
                              } catch (err: any) { toast.error(err.response?.data?.message || "Gagal", { id: tid }); }
                            }}>Simpan</button>
                          <button className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-md transition-colors" onClick={() => setEditingCategoryId(null)}>Batal</button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Pilih Ikon Baru</label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin pr-2">
                          {CATEGORY_ICONS.map((iconName) => {
                            const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.Briefcase;
                            return (
                              <button key={iconName} type="button" title={iconName}
                                onClick={(e) => { e.stopPropagation(); setLocalCategories(prev => prev.map(c => c.id === cat.id ? { ...c, icon: iconName } : c)); }}
                                className={`p-1.5 rounded-lg transition-all ${cat.icon === iconName ? 'bg-daw-green text-white shadow-md scale-110 relative z-10' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-daw-green hover:text-daw-green hover:bg-white'}`}>
                                <IconComponent className="w-4 h-4" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-sm font-bold text-slate-900 capitalize">{cat.name}</h4>
                      {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {companiesInCat.length} perusahaan
                </span>
                {isEditing && !isEditingThisCat && (
                  <>
                    <button onClick={() => setEditingCategoryId(cat.id)} className="p-1 text-slate-400 hover:text-daw-green rounded transition-colors" title="Edit Kategori">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => {
                      if (companiesInCat.length > 0) return toast.error("Tidak bisa hapus kategori yang masih memiliki perusahaan.");
                      toast.warning(`Hapus kategori "${cat.name}"?`, {
                        action: { label: "Hapus", onClick: async () => {
                          const tid = toast.loading("Menghapus...");
                          try { await api.delete(`/investments/categories/${cat.id}`); toast.success("Kategori dihapus!", { id: tid }); await refreshData(); }
                          catch (err: any) { toast.error(err.response?.data?.message || "Gagal", { id: tid }); }
                        }}, cancel: { label: "Batal", onClick: () => {} }
                      });
                    }} className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Hapus Kategori">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* COMPANIES INSIDE THIS CATEGORY */}
            {!cat.isCollapsed && (
              <div className="p-5 space-y-4">
                {isEditing && (
                  <button onClick={() => addCompany(cat.id as number)} disabled={isSaving}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-300 hover:border-daw-green text-slate-400 hover:text-daw-green rounded-lg text-xs font-bold transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Tambah Perusahaan ke {cat.name}
                  </button>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {companiesInCat.map((company) => {
                    const isNeedsRevision = company.has_rejected === true;
                    const isPending = company.is_locked && !isNeedsRevision;
                    const isDeleting = isPending && company.lock_ticket?.includes("DEL");
                    const isLockedForEditor = isPending && !isSuperadmin;
                    const draft = rejectedAffiliates[company.id];
                    const cardStyle = isDeleting ? "bg-rose-50/40 border-l-4 border-l-rose-500 border-rose-200 grayscale opacity-80"
                      : isNeedsRevision ? "bg-red-50/30 border-l-4 border-l-red-500 border-red-200 shadow-sm ring-1 ring-red-500/20"
                      : isLockedForEditor ? "bg-slate-50 border-l-4 border-l-blue-500 border-slate-200 grayscale opacity-70 pointer-events-none"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-sm";

                    return (
                      <div key={company.id} className={`flex flex-col gap-3 p-4 rounded-xl border transition-all relative ${cardStyle}`}>
                        {isNeedsRevision && draft && (
                          <div className="w-full bg-red-50 border-l-4 border-l-red-500 border-y border-r border-red-200 rounded-lg p-3 shadow-sm animate-in fade-in">
                            <div className="flex items-center gap-2 text-red-900 mb-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-black uppercase">⚠️ Catatan Peninjau</span>
                            </div>
                            <p className="text-[10px] text-red-800 bg-white/60 p-2 rounded border border-red-200/50 mb-2">"{draft.rejection_reason || "Perbaiki sesuai arahan."}"</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleRestoreAffiliateDraft(company.id)} disabled={!isEditing}
                                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-3 py-1.5 rounded text-[9px] font-bold">
                                <RotateCcw className="w-2.5 h-2.5" /> PULIHKAN
                              </button>
                              <button onClick={() => handleDiscardAffiliateDraft(company.id)}
                                className="flex items-center gap-1 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded text-[9px] font-bold">
                                <X className="w-2.5 h-2.5" /> ABAIKAN
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-3 items-start w-full">
                          <div className="w-20 shrink-0 relative">
                            <div className="absolute -top-2 -right-2 z-20 flex flex-col gap-1">
                              {(company.isDirty || company.isNew) && !isPending && !isNeedsRevision && (
                                <span className="flex h-4 w-4 items-center justify-center bg-daw-green text-white rounded-full shadow-sm ring-2 ring-white">
                                  <Save className="w-2 h-2" />
                                </span>
                              )}
                            </div>
                            <LogoPreviewer file={company.newLogoFile} savedUrl={company.removePhoto ? null : company.logoUrl}
                              isEditing={isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision}
                              onRemove={() => { updateCompany(company.id, "removePhoto", true); updateCompany(company.id, "newLogoFile", null); }} />
                            {isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision && (
                              <input type="file" accept="image/*" onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  setCurrentCropFile({ file: e.target.files[0], companyId: company.id });
                                  e.target.value = '';
                                }
                              }}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            )}
                          </div>
                          <fieldset disabled={!isEditing || isLockedForEditor || isDeleting || isNeedsRevision} className="flex-1 space-y-2">
                            <input type="text" value={company.name} placeholder="Company Name"
                              onChange={(e) => updateCompany(company.id, "name", e.target.value)}
                              className={`w-full px-3 py-1.5 text-sm rounded-md font-bold outline-none ${isEditing && !isLockedForEditor ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-transparent border-transparent"} ${isDeleting ? "line-through text-rose-800" : "text-slate-900"}`} />
                            <input type="text" placeholder="Sub-text (Optional)" value={company.desc}
                              onChange={(e) => updateCompany(company.id, "desc", e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs rounded-md outline-none ${isEditing && !isLockedForEditor ? "bg-white border border-slate-300" : "bg-transparent border-transparent text-slate-500"}`} />
                            <input type="url" placeholder="Website URL (https://)" value={company.websiteUrl || ""}
                              onChange={(e) => updateCompany(company.id, "websiteUrl", e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs rounded-md outline-none ${isEditing && !isLockedForEditor ? "bg-white border border-slate-300" : "bg-transparent border-transparent text-slate-500"}`} />
                          </fieldset>
                          {isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision && (
                            <button onClick={() => removeCompany(company.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md shrink-0 transition-colors" title="Hapus">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {companiesInCat.length === 0 && !isEditing && (
                  <p className="text-center text-xs text-slate-400 italic py-4">Belum ada perusahaan di kategori ini.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {localCategories.length === 0 && (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <FolderPlus className="w-10 h-10 text-slate-300" />
          <div>
            <h4 className="font-bold text-slate-700">Belum Ada Kategori</h4>
            <p className="text-xs mt-1">Klik "Tambah Kategori" untuk memulai membangun ekosistem investasi.</p>
          </div>
        </div>
      )}

      <ImageAdjustmentModal
        isOpen={!!currentCropFile}
        onClose={() => setCurrentCropFile(null)}
        imageFile={currentCropFile?.file || null}
        onSave={(croppedFile) => {
          if (currentCropFile) {
            handleLogoChange(currentCropFile.companyId, croppedFile);
          }
          setCurrentCropFile(null);
        }}
        aspectRatio={1}
        title="Sesuaikan Logo Perusahaan"
      />
    </div>
  );
}
