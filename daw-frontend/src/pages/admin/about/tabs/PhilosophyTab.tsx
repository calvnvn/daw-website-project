import React, { useState, useEffect, useMemo } from "react";
import {
  Lock,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  Save,
  Target,
  Plus,
  Edit,
  Trash2,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAbout } from "@/contexts/AboutContext";
import type { PhilosophyPillar } from "@/contexts/AboutContext";
import { AVAILABLE_ICONS } from "../AboutConstants";
import AboutLivePreview from "@/components/admin/about/AboutLivePreview";
import { getErrorMessage } from "@/lib/utils";

interface PhilosophyTabProps {
  isEditing: boolean;
  isSuperadmin: boolean;
  isEditor: boolean;
  mode?: "edit" | "preview";
}

export default function PhilosophyTab({
  isEditing,
  isSuperadmin,
  isEditor,
  mode = "edit",
}: PhilosophyTabProps) {
  const { philosophyData, philosophyPillars, refreshData } = useAbout();

  // SINGLETON LOGIC (Main Title)
  const [titleForm, setTitleForm] = useState("Our Philosophy");
  const [originalTitle, setOriginalTitle] = useState("Our Philosophy");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [rejectedTitleDraft, setRejectedTitleDraft] = useState<any | null>(
    null,
  );

  useEffect(() => {
    if (philosophyData) {
      setTitleForm(philosophyData.philosophyTitle || "Our Philosophy");
      setOriginalTitle(philosophyData.philosophyTitle || "Our Philosophy");
    }
  }, [philosophyData]);

  useEffect(() => {
    if (philosophyData?.hasRejected && !rejectedTitleDraft && isEditor) {
      const controller = new AbortController();
      api
        .get("/approval/rejected/1?module=Philosophy", {
          signal: controller.signal,
        })
        .then((res) => {
          if (res.data?.data) setRejectedTitleDraft(res.data.data);
        })
        .catch(() => {});
      return () => controller.abort();
    }
  }, [philosophyData?.hasRejected, isEditor, rejectedTitleDraft]);

  const hasTitleChanged = useMemo(
    () => titleForm !== originalTitle,
    [titleForm, originalTitle],
  );
  const isTitleLocked = philosophyData?.is_locked && !isSuperadmin;

  const handleDiscardTitleDraft = async () => {
    if (!rejectedTitleDraft?.notrans) return;
    const loadingToast = toast.loading("Membersihkan notifikasi...");
    try {
      await api.patch("/approval/discard", {
        notrans: rejectedPillarDraft.notrans,
      });
      setRejectedTitleDraft(null);
      await refreshData();
      toast.success("Notifikasi headline berhasil dibersihkan.", {
        id: loadingToast,
      });
    } catch (error) {
      console.error(error);
      toast.error("Gagal membersihkan notifikasi.", { id: loadingToast });
    }
  };

  const saveTitle = async () => {
    if (!hasTitleChanged) return;
    setIsSavingTitle(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan persetujuan..." : "Menyimpan live...",
    );
    try {
      const payload: any = {
        philosophyTitle: titleForm,
        status: isSuperadmin ? "Active" : "Published",
      };
      if (isEditor && rejectedTitleDraft?.notrans)
        payload.previous_notrans = rejectedTitleDraft.notrans;
      await api.put("/philosophy", payload, { timeout: 60000 });
      setRejectedTitleDraft(null);
      await refreshData();
      toast.success(
        isSuperadmin ? "Headline disimpan!" : "Draf headline diajukan!",
        { id: loadingToast },
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Kesalahan jaringan", {
        id: loadingToast,
      });
    } finally {
      setIsSavingTitle(false);
    }
  };

  // COLLECTION LOGIC (Pillars & Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPillarId, setEditingPillarId] = useState<number | null>(null);
  const [isSavingPillar, setIsSavingPillar] = useState(false);
  const [rejectedPillarDraft, setRejectedPillarDraft] = useState<any | null>(
    null,
  );
  const [openIconPicker, setOpenIconPicker] = useState(false);

  const [pillarForm, setPillarForm] = useState({
    iconId: "human",
    title: "",
    text: "",
    orderIndex: 1,
    previous_notrans: null as string | null,
    originalSnapshot: null as string | null,
  });

  const openPillarModal = async (pillar: PhilosophyPillar | null = null) => {
    const isLockedAndNotRejected = pillar?.is_locked && !pillar?.hasRejected;
    if (isLockedAndNotRejected && !isSuperadmin) {
      return toast.warning("Akses Dibatasi", {
        description: "Pilar ini sedang dalam peninjauan manajer.",
      });
    }

    let draftData = null;
    if (pillar?.hasRejected && isEditor) {
      const toastId = toast.loading("Menarik catatan revisi...");
      try {
        const res = await api.get(
          `/approval/rejected/${pillar.id}?module=PhilosophyPillar`,
        );
        draftData = res.data?.data;
        setRejectedPillarDraft(draftData);
        toast.dismiss(toastId);
      } catch {
        toast.error("Gagal menarik catatan revisi", { id: toastId });
      }
    } else {
      setRejectedPillarDraft(null);
    }

    if (pillar) {
      setEditingPillarId(pillar.id);
      setPillarForm({
        iconId: draftData?.payload?.iconId ?? pillar.iconId,
        title: draftData?.payload?.title ?? pillar.title,
        text: draftData?.payload?.text ?? pillar.text,
        orderIndex: draftData?.payload?.orderIndex ?? pillar.orderIndex,
        previous_notrans: draftData?.notrans || null,
        originalSnapshot: JSON.stringify({
          iconId: pillar.iconId,
          title: pillar.title,
          text: pillar.text,
          orderIndex: pillar.orderIndex,
        }),
      });
    } else {
      setEditingPillarId(null);
      setPillarForm({
        iconId: "human",
        title: "",
        text: "",
        orderIndex: philosophyPillars.length + 1,
        previous_notrans: null,
        originalSnapshot: null,
      });
    }
    setIsModalOpen(true);
  };

  const hasPillarChanged = useMemo(() => {
    if (!editingPillarId || !pillarForm.originalSnapshot) return true;
    const current = {
      iconId: pillarForm.iconId,
      title: pillarForm.title,
      text: pillarForm.text,
      orderIndex: pillarForm.orderIndex,
    };
    return JSON.stringify(current) !== pillarForm.originalSnapshot;
  }, [pillarForm, editingPillarId]);
  const handleRestoreTitleData = () => {
    if (!rejectedTitleDraft?.payload) return;
    try {
      const payload =
        typeof rejectedTitleDraft.payload === "string"
          ? JSON.parse(rejectedTitleDraft.payload)
          : rejectedTitleDraft.payload;

      setTitleForm(payload?.philosophyTitle || titleForm);
      toast.success("Draf headline dipulihkan!");
    } catch (err) {
      toast.error("Gagal memulihkan data draf.");
    }
  };
  const handleRestorePillarData = () => {
    if (!rejectedPillarDraft?.payload) return;
    try {
      const payload =
        typeof rejectedPillarDraft.payload === "string"
          ? JSON.parse(rejectedPillarDraft.payload)
          : rejectedPillarDraft.payload;

      setPillarForm((prev) => ({
        ...prev,
        iconId: payload.iconId ?? prev.iconId,
        title: payload.title ?? prev.title,
        text: payload.text ?? prev.text,
        orderIndex: payload.orderIndex ?? prev.orderIndex,
      }));
      toast.success("Data draf berhasil dipulihkan!");
    } catch {
      toast.error("Format data draf tidak valid.");
    }
  };

  const handleDiscardPillarDraft = async () => {
    if (!rejectedPillarDraft?.notrans) return;
    const loadingToast = toast.loading("Membersihkan notifikasi pilar...");
    try {
      await api.patch("/approval/discard", {
        notrans: rejectedPillarDraft.notrans,
      });
      setRejectedPillarDraft(null);
      await refreshData();
      toast.success("Notifikasi pilar dibersihkan.", { id: loadingToast });
      setIsModalOpen(false);
    } catch {
      toast.error("Gagal membersihkan notifikasi.", { id: loadingToast });
    }
  };

  const savePillar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pillarForm.title.trim() || !pillarForm.text.trim())
      return toast.error("Lengkapi judul dan deskripsi.");
    const hasChanged =
      !editingPillarId ||
      JSON.stringify({
        iconId: pillarForm.iconId,
        title: pillarForm.title,
        text: pillarForm.text,
        orderIndex: pillarForm.orderIndex,
      }) !== pillarForm.originalSnapshot;
    if (!hasChanged) return toast.info("Tidak ada perubahan.");

    setIsSavingPillar(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan pilar..." : "Menyimpan pilar...",
    );
    try {
      const payload: any = {
        iconId: pillarForm.iconId,
        title: pillarForm.title,
        text: pillarForm.text,
        orderIndex: pillarForm.orderIndex,
        status: isSuperadmin ? "Active" : "Published",
      };
      if (isEditor && pillarForm.previous_notrans)
        payload.previous_notrans = pillarForm.previous_notrans;

      if (editingPillarId) {
        await api.put(`/philosophy-pillars/${editingPillarId}`, payload, {
          timeout: 60000,
        });
      } else {
        await api.post("/philosophy-pillars", payload, { timeout: 60000 });
      }

      await refreshData();
      toast.success(
        isSuperadmin ? "Pilar diperbarui!" : "Draf pilar diajukan!",
        { id: loadingToast },
      );
      setIsModalOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Sistem error", {
        id: loadingToast,
      });
    } finally {
      setIsSavingPillar(false);
    }
  };

  const deletePillar = (id: number) => {
    toast("Konfirmasi Hapus", {
      description: "Yakin ingin menghapus pilar ini?",
      action: {
        label: "Hapus",
        onClick: async () => {
          const loadingToast = toast.loading("Memproses...");
          try {
            await api.delete(`/philosophy-pillars/${id}`);
            await refreshData();
            toast.success(
              isEditor ? "Pengajuan hapus dikirim!" : "Pilar dihapus!",
              { id: loadingToast },
            );
          } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Gagal", {
              id: loadingToast,
            });
          }
        },
      },
    });
  };

  // --- RENDER ---
  if (mode === "preview") {
    // For philosophy preview, we need to merge the local titleForm and philosophyPillars
    // Wait, what if the user edited a pillar in the modal and didn't save?
    // Actually, philosophy pillars save independently. So we just pass the updated titleForm and the current philosophyPillars.
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        <AboutLivePreview type="philosophy" data={titleForm} extraData={philosophyPillars} />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      {/* ==========================================
          SECTION 1: MAIN TITLE (SINGLETON)
          ========================================== */}
      <div
        className={`space-y-6 pb-8 border-b border-slate-200 ${isTitleLocked ? "opacity-60 grayscale-[30%] pointer-events-none select-none" : ""}`}>
        {/* 🚀 REFACTOR: BUREAUCRATIC MIRROR - Red Recovery Banner untuk Title */}
        {rejectedTitleDraft && !isTitleLocked && (
          <div className="p-5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-4 text-red-700 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-300">
            <div className="p-2 bg-red-100 rounded-lg h-fit shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
              <div className="flex-1 space-y-3">
                <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                  ⚠️ Revisi Ditolak: Headline
                </h4>
                <p className="text-xs text-red-800 leading-relaxed font-medium bg-white/60 p-3 rounded-md border border-red-200/50 shadow-inner">
                  "
                  {rejectedTitleDraft.rejection_reason ||
                    "Silakan perbaiki data sesuai arahan."}
                  "
                </p>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={handleRestoreTitleData}
                    disabled={!isEditing}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                    <RotateCcw
                      className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                    />
                    PULIHKAN DATA
                  </button>

                  <button
                    onClick={handleDiscardTitleDraft}
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
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 w-full max-w-md">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Main Section Title
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={titleForm}
                onChange={(e) => setTitleForm(e.target.value)}
                disabled={!isEditing || isTitleLocked}
                className="w-full px-4 py-3 rounded-lg font-serif text-xl border border-slate-200 focus:ring-2 focus:ring-daw-green/20 disabled:bg-slate-100"
              />
              <button
                onClick={saveTitle}
                disabled={
                  !isEditing ||
                  isTitleLocked ||
                  isSavingTitle ||
                  !hasTitleChanged
                }
                className="flex items-center justify-center bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-md shrink-0">
                {isSavingTitle ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          {isTitleLocked && (
            <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
              <Lock className="w-3.5 h-3.5" /> Akses Dibatasi
            </span>
          )}
        </div>
      </div>

      {/* ==========================================
          SECTION 2: PILLARS COLLECTION (GRANULAR)
           */}
      <div>
        {/* REJECTION RIBBON (Pillars) */}
        {isEditor && philosophyPillars.some((p) => p.hasRejected) && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 shadow-sm mb-6">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">Draf Pilar Ditolak</h4>
              <p className="text-sm text-red-600/80">
                Satu atau lebih draf nilai inti yang Anda ajukan telah ditolak oleh Approver.
                Silakan klik tombol <b>'Edit'</b> pada kartu pilar dengan peringatan merah untuk melihat revisi terakhir, memulihkan data, atau mengabaikan notifikasi penolakan.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              Philosophy Pillars
            </h3>
            <p className="text-sm text-slate-500">
              Kelola nilai-nilai inti perusahaan. (Granular Edit)
            </p>
          </div>
          {isEditing && (
            <button
              onClick={() => openPillarModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg text-sm font-bold shadow-sm active:scale-95">
              <Plus className="w-4 h-4" /> Tambah Pilar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {philosophyPillars.map((pillar) => {
            const SelectedIcon =
              AVAILABLE_ICONS.find((i) => i.id === pillar.iconId)?.icon ||
              Target;
            // 🚀 FIX: Baris tidak terkunci abu-abu jika ada rejection
            const isRowLocked =
              pillar.is_locked && !pillar.hasRejected && !isSuperadmin;

            return (
              <div
                key={pillar.id}
                className={`bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start group relative transition-all ${
                  isRowLocked ? "opacity-60 grayscale-[30%]" : "hover:shadow-md"
                }`}>
                <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                  <SelectedIcon className="w-6 h-6 text-daw-green opacity-80" />
                </div>
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {pillar.title}
                    </h4>
                    {pillar.hasRejected && !isSuperadmin && (
                      <span
                        title="Perlu Revisi"
                        className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white"
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                    {pillar.text}
                  </p>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
                  {isRowLocked ? (
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 whitespace-nowrap uppercase tracking-widest">
                      <Lock className="w-3 h-3" /> Pending
                    </span>
                  ) : isEditing ? (
                    <>
                      <button
                        onClick={() => openPillarModal(pillar)}
                        className={`p-2 rounded-lg transition-colors border ${
                          pillar.hasRejected
                            ? "text-red-600 bg-red-50 border-red-200 hover:bg-red-100 animate-pulse"
                            : "text-slate-400 bg-white border-slate-200 hover:text-daw-green"
                        }`}
                        title="Edit / Perbaiki Pilar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePillar(pillar.id)}
                        className="p-2 text-slate-400 bg-white hover:text-red-600 border border-slate-200 rounded-lg transition-colors"
                        title="Hapus Pilar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: CREATE / EDIT PILLAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {editingPillarId ? (
                  <Edit className="w-5 h-5 text-daw-green" />
                ) : (
                  <Plus className="w-5 h-5 text-daw-green" />
                )}
                {editingPillarId ? "Edit Pilar Filosofi" : "Tambah Pilar Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors">
                ✕
              </button>
            </div>

            {/* 🛡️ REJECTION RIBBON (Modal) */}
            {rejectedPillarDraft && (
              <div className="bg-red-50 border-b border-red-200 p-5 shrink-0 animate-in slide-in-from-top-2">
                <div className="flex gap-3 items-start">
                  <div className="bg-red-100 p-2 rounded-lg shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-xs text-red-900 uppercase tracking-tighter">
                      Draf Ditolak
                    </h4>
                    <p className="text-xs text-red-800 mt-1 mb-3">
                      {rejectedPillarDraft.rejection_reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {rejectedPillarDraft.action !== "DELETE" && (
                        <button
                          onClick={handleRestorePillarData}
                          type="button"
                          className="text-[10px] font-black bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">
                          <RotateCcw className="w-3 h-3" /> PULIHKAN DATA
                        </button>
                      )}
                      <button
                        onClick={handleDiscardPillarDraft}
                        type="button"
                        className="text-[10px] font-black bg-white text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm active:scale-95 uppercase tracking-widest">
                        <X className="w-3 h-3" /> ABAIKAN NOTIFIKASI
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FORM AREA */}
            <div className="overflow-y-auto p-6">
              <form
                id="pillar-form"
                onSubmit={savePillar}
                className="space-y-6">
                {rejectedPillarDraft?.action === "DELETE" ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-sm text-red-600 font-medium">
                      Pengajuan hapus ditolak. Klik "Abaikan Notifikasi" di atas
                      untuk membuka kembali akses form ini.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Ikon Pilar
                        </label>
                        <button
                          type="button"
                          onClick={() => setOpenIconPicker(!openIconPicker)}
                          className="flex items-center justify-between w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-daw-green/20">
                          <div className="flex items-center gap-2">
                            {React.createElement(
                              AVAILABLE_ICONS.find(
                                (i) => i.id === pillarForm.iconId,
                              )?.icon || Target,
                              { className: "w-4 h-4 text-slate-500" },
                            )}
                            <span>
                              {
                                AVAILABLE_ICONS.find(
                                  (i) => i.id === pillarForm.iconId,
                                )?.label
                              }
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                        {openIconPicker && (
                          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            {AVAILABLE_ICONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setPillarForm({
                                    ...pillarForm,
                                    iconId: opt.id,
                                  });
                                  setOpenIconPicker(false);
                                }}
                                className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                                <opt.icon className="w-4 h-4 text-slate-400" />{" "}
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Urutan Tampilan
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={pillarForm.orderIndex}
                          onChange={(e) =>
                            setPillarForm({
                              ...pillarForm,
                              orderIndex: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Pillar Title
                      </label>
                      <input
                        type="text"
                        required
                        value={pillarForm.title}
                        onChange={(e) =>
                          setPillarForm({
                            ...pillarForm,
                            title: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={pillarForm.text}
                        onChange={(e) =>
                          setPillarForm({ ...pillarForm, text: e.target.value })
                        }
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 resize-none"
                      />
                    </div>
                  </>
                )}
              </form>
            </div>

            {/* MODAL FOOTER */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              {rejectedPillarDraft?.action !== "DELETE" && (
                <button
                  form="pillar-form"
                  type="submit"
                  disabled={isSavingPillar || !hasPillarChanged}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
                    isSavingPillar
                      ? "bg-slate-300 text-slate-700"
                      : isSuperadmin
                        ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                  }`}>
                  {isSavingPillar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isSuperadmin ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isSavingPillar
                      ? "Memproses..."
                      : isSuperadmin
                        ? "Publish Data"
                        : "Ajukan Draf"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
