import React, { useState, useEffect, useMemo } from "react";
import {
  Lock,
  AlertTriangle,
  RotateCcw,
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
import MagicTranslationField from "@/components/admin/MagicTranslationField";
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
  const [terjemahanTitle, setTerjemahanTitle] = useState("");
  const [originalTerjemahanTitle, setOriginalTerjemahanTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [rejectedTitleDraft, setRejectedTitleDraft] = useState<any | null>(
    null,
  );

  useEffect(() => {
    if (philosophyData) {
      setTitleForm(philosophyData.philosophyTitle || "Our Philosophy");
      setOriginalTitle(philosophyData.philosophyTitle || "Our Philosophy");
    }

    api
      .get("/translation/manual?modelName=Philosophy&recordId=1")
      .then((res) => {
        if (res.data?.data?.id) {
          setTerjemahanTitle(res.data.data.id.philosophyTitle || "");
          setOriginalTerjemahanTitle(res.data.data.id.philosophyTitle || "");
        }
      })
      .catch(console.error);
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
    () =>
      titleForm !== originalTitle ||
      terjemahanTitle !== originalTerjemahanTitle,
    [titleForm, originalTitle, terjemahanTitle, originalTerjemahanTitle],
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
        _translations: {
          id: {
            philosophyTitle: terjemahanTitle,
          },
        },
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

  const [pillarForm, setPillarForm] = useState({
    iconId: "human",
    title: "",
    text: "",
    orderIndex: 1,
    previous_notrans: null as string | null,
    originalSnapshot: null as string | null,
    terjemahanTitle: "",
    terjemahanText: "",
    originalTerjemahanTitle: "",
    originalTerjemahanText: "",
  });

  const openPillarModal = async (pillar: PhilosophyPillar | null = null) => {
    const isLockedAndNotRejected = pillar?.is_locked && !pillar?.hasRejected;
    if (isLockedAndNotRejected && !isSuperadmin) {
      return toast.warning("Akses Dibatasi", {
        description: "Pilar ini sedang dalam peninjauan approver.",
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
        terjemahanTitle: "",
        terjemahanText: "",
        originalTerjemahanTitle: "",
        originalTerjemahanText: "",
      });

      api
        .get(
          `/translation/manual?modelName=PhilosophyPillar&recordId=${pillar.id}`,
        )
        .then((res) => {
          if (res.data?.data?.id) {
            const trans = res.data.data.id;
            setPillarForm((prev) => ({
              ...prev,
              terjemahanTitle: trans.title || "",
              originalTerjemahanTitle: trans.title || "",
              terjemahanText: trans.text || "",
              originalTerjemahanText: trans.text || "",
            }));
          }
        })
        .catch(console.error);
    } else {
      setEditingPillarId(null);
      setPillarForm({
        iconId: "human",
        title: "",
        text: "",
        orderIndex: philosophyPillars.length + 1,
        previous_notrans: null,
        originalSnapshot: null,
        terjemahanTitle: "",
        terjemahanText: "",
        originalTerjemahanTitle: "",
        originalTerjemahanText: "",
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
    const isTransChanged =
      pillarForm.terjemahanTitle !== pillarForm.originalTerjemahanTitle ||
      pillarForm.terjemahanText !== pillarForm.originalTerjemahanText;
    return (
      JSON.stringify(current) !== pillarForm.originalSnapshot || isTransChanged
    );
  }, [pillarForm, editingPillarId]);
  const handleRestoreTitleData = () => {
    if (!rejectedTitleDraft?.payload) return;
    try {
      const payload =
        typeof rejectedTitleDraft.payload === "string"
          ? JSON.parse(rejectedTitleDraft.payload)
          : rejectedTitleDraft.payload;

      setTitleForm(payload?.philosophyTitle || titleForm);
      if (payload?._translations?.id?.philosophyTitle) {
        setTerjemahanTitle(payload._translations.id.philosophyTitle);
      }
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
        terjemahanTitle:
          payload._translations?.id?.title ?? prev.terjemahanTitle,
        terjemahanText: payload._translations?.id?.text ?? prev.terjemahanText,
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
        _translations: {
          id: {
            title: pillarForm.terjemahanTitle,
            text: pillarForm.terjemahanText,
          },
        },
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
        <AboutLivePreview
          type="philosophy"
          data={titleForm}
          extraData={philosophyPillars}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      {/*
          SECTION 1: MAIN TITLE (SINGLETON)
         */}
      <div
        className={`bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm relative overflow-hidden ${isTitleLocked ? "opacity-75 grayscale-[20%] pointer-events-none select-none" : ""}`}>
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-daw-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* REFACTOR: BUREAUCRATIC MIRROR - Red Recovery Banner untuk Title */}
        {rejectedTitleDraft && !isTitleLocked && (
          <div className="p-5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-4 text-red-700 shadow-sm mb-8 animate-in slide-in-from-top-4 duration-300 relative z-10">
            <div className="p-2 bg-red-100 rounded-xl h-fit shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                ⚠️ Revisi Ditolak: Headline
              </h4>
              <p className="text-xs text-red-800 leading-relaxed font-medium bg-white/60 p-3.5 rounded-xl border border-red-200/50 shadow-inner">
                "
                {rejectedTitleDraft.rejection_reason ||
                  "Silakan perbaiki data sesuai arahan."}
                "
              </p>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleRestoreTitleData}
                  disabled={!isEditing}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                  />
                  PULIHKAN DATA
                </button>
                <button
                  onClick={handleDiscardTitleDraft}
                  className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
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

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Headline Identity
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Pengaturan judul utama halaman nilai-nilai perusahaan.
              </p>
            </div>
            {isTitleLocked && (
              <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
                <Lock className="w-3.5 h-3.5" /> Terkunci (Review)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            {/* English Column */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                  EN
                </span>
                Main Title (English)
              </label>
              <input
                type="text"
                value={titleForm}
                onChange={(e) => setTitleForm(e.target.value)}
                disabled={!isEditing || isTitleLocked}
                className="w-full px-5 py-4 rounded-2xl font-serif text-2xl text-slate-800 border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green transition-all disabled:opacity-70"
                placeholder="Our Philosophy"
              />
            </div>

            {/* Indonesian Column */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-black text-daw-green uppercase tracking-widest">
                <span className="w-5 h-5 rounded-md bg-daw-green/10 flex items-center justify-center text-daw-green font-bold">
                  ID
                </span>
                Main Title (Indonesian)
              </label>
              <div className="pt-0.5">
                <MagicTranslationField
                  label="Main Title (Indonesian)"
                  originalText={titleForm}
                  value={terjemahanTitle}
                  onChange={setTerjemahanTitle}
                  disabled={!isEditing || isTitleLocked}
                  className="!mt-0 !rounded-2xl !py-[18px] !px-5 !bg-slate-50/50 hover:!bg-white !border-slate-200 focus-within:!ring-4 focus-within:!ring-daw-green/10 focus-within:!border-daw-green transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={saveTitle}
              disabled={
                !isEditing || isTitleLocked || isSavingTitle || !hasTitleChanged
              }
              className="flex items-center gap-2.5 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-xl shadow-daw-green/20 hover:-translate-y-0.5 active:scale-95">
              {isSavingTitle ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isSavingTitle ? "Menyimpan..." : "Simpan Headline"}
            </button>
          </div>
        </div>
      </div>

      {/*
          SECTION 2: PILLARS COLLECTION (GRANULAR)
        */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm relative overflow-hidden group">
        {/* Background Accent */}
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-daw-green/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none z-0" />
        {/* REJECTION RIBBON (Pillars) */}
        {isEditor && philosophyPillars.some((p) => p.hasRejected) && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 shadow-sm mb-6">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold">Draf Pilar Ditolak</h4>
              <p className="text-sm text-red-600/80">
                Satu atau lebih draf nilai inti yang Anda ajukan telah ditolak
                oleh Approver. Silakan klik tombol <b>'Edit'</b> pada kartu
                pilar dengan peringatan merah untuk melihat revisi terakhir,
                memulihkan data, atau mengabaikan notifikasi penolakan.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Core Pillars
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Kelola nilai-nilai inti perusahaan secara terperinci.
            </p>
          </div>
          {isEditing && (
            <button
              onClick={() => openPillarModal()}
              className="flex items-center gap-2 px-5 py-2.5 bg-daw-green hover:bg-[#003b1c] text-white rounded-xl text-xs font-bold shadow-lg shadow-daw-green/20 hover:-translate-y-0.5 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> TAMBAH PILAR
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {philosophyPillars.map((pillar) => {
            const SelectedIcon =
              AVAILABLE_ICONS.find((i) => i.id === pillar.iconId)?.icon ||
              Target;
            const isRowLocked =
              pillar.is_locked && !pillar.hasRejected && !isSuperadmin;
            // Cek apakah ada data ID di payload, fallback ke check field ID
            const hasTranslation =
              !!(pillar as any)._translations?.id?.title || pillar.title !== "";

            return (
              <div
                key={pillar.id}
                className={`bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col items-start group relative transition-all overflow-hidden z-10 ${
                  isRowLocked
                    ? "opacity-60 grayscale-[30%]"
                    : "hover:shadow-xl hover:border-daw-green/30 hover:-translate-y-1 hover:bg-white"
                }`}>
                {/* Number Watermark */}
                <div className="absolute -bottom-4 -right-2 text-[100px] font-black text-slate-50 leading-none select-none pointer-events-none group-hover:text-daw-green/5 transition-colors z-0">
                  {pillar.orderIndex}
                </div>

                {/* Card Header */}
                <div className="flex items-start justify-between w-full relative z-10 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-daw-green/10 to-daw-green/5 border border-daw-green/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <SelectedIcon className="w-7 h-7 text-daw-green" />
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {pillar.hasRejected && !isSuperadmin && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        Revisi
                      </span>
                    )}
                    {isRowLocked ? (
                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1 uppercase tracking-widest">
                        <Lock className="w-2.5 h-2.5" /> Pending
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full text-[9px] font-bold text-slate-400">
                        <span className="text-slate-600">EN</span>
                        <span className="w-0.5 h-3 bg-slate-200"></span>
                        <span
                          className={
                            hasTranslation ? "text-daw-green" : "text-slate-300"
                          }>
                          ID
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative z-10 flex-1 w-full pb-4">
                  <h4 className="font-black text-slate-900 text-base mb-2 group-hover:text-daw-green transition-colors">
                    {pillar.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {pillar.text}
                  </p>
                </div>

                {/* Hover Actions Bar */}
                {isEditing && !isRowLocked && (
                  <div className="absolute bottom-0 left-0 right-0 p-5 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all bg-gradient-to-t from-white via-white to-white/90 pt-10 z-20 flex justify-end gap-2">
                    <button
                      onClick={() => openPillarModal(pillar)}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        pillar.hasRejected
                          ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-daw-green hover:text-daw-green hover:shadow-md"
                      }`}
                      title="Edit / Perbaiki Pilar">
                      <Edit className="w-3.5 h-3.5" />{" "}
                      {pillar.hasRejected ? "Perbaiki" : "Edit"}
                    </button>
                    <button
                      onClick={() => deletePillar(pillar.id)}
                      className="p-2 text-slate-400 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-xl transition-colors shadow-sm"
                      title="Hapus Pilar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: CREATE / EDIT PILLAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
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
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                      <div className="sm:col-span-9">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Pilih Ikon Pilar
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                          {AVAILABLE_ICONS.map((opt) => {
                            const isSelected = pillarForm.iconId === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setPillarForm({
                                    ...pillarForm,
                                    iconId: opt.id,
                                  })
                                }
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${
                                  isSelected
                                    ? "bg-daw-green/10 border-daw-green shadow-inner ring-2 ring-daw-green/20 scale-105"
                                    : "bg-slate-50 border-slate-200 hover:bg-white hover:border-daw-green hover:shadow-md"
                                }`}
                                title={opt.label}>
                                <opt.icon
                                  className={`w-6 h-6 ${isSelected ? "text-daw-green" : "text-slate-400"}`}
                                />
                                <span
                                  className={`text-[9px] font-bold text-center line-clamp-1 ${isSelected ? "text-daw-green" : "text-slate-500"}`}>
                                  {opt.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                          Urutan Tampil
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
                          className="w-full px-5 py-4 text-center font-black text-2xl text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50/80 border border-slate-100 rounded-2xl">
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <span className="w-5 h-5 rounded-md bg-slate-200 flex items-center justify-center text-slate-600">
                            EN
                          </span>{" "}
                          Title (English)
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
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-daw-green uppercase tracking-widest">
                          <span className="w-5 h-5 rounded-md bg-daw-green/10 flex items-center justify-center text-daw-green">
                            ID
                          </span>{" "}
                          Title (Indonesian)
                        </label>
                        <div className="pt-0.5">
                          <MagicTranslationField
                            label="Terjemahan Judul (ID)"
                            originalText={pillarForm.title}
                            value={pillarForm.terjemahanTitle}
                            onChange={(v) =>
                              setPillarForm({
                                ...pillarForm,
                                terjemahanTitle: v,
                              })
                            }
                            disabled={isSavingPillar}
                            className="!mt-0 !rounded-xl !py-[13px] !px-4 !bg-slate-50/50 hover:!bg-white !border-slate-200 focus-within:!ring-4 focus-within:!ring-daw-green/10 focus-within:!border-daw-green transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-slate-50/80 border border-slate-100 rounded-2xl">
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <span className="w-5 h-5 rounded-md bg-slate-200 flex items-center justify-center text-slate-600">
                            EN
                          </span>{" "}
                          Description (English)
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={pillarForm.text}
                          onChange={(e) =>
                            setPillarForm({
                              ...pillarForm,
                              text: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green transition-all resize-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-daw-green uppercase tracking-widest">
                          <span className="w-5 h-5 rounded-md bg-daw-green/10 flex items-center justify-center text-daw-green">
                            ID
                          </span>{" "}
                          Description (Indonesian)
                        </label>
                        <div className="pt-0.5">
                          <MagicTranslationField
                            label="Terjemahan Deskripsi (ID)"
                            originalText={pillarForm.text}
                            value={pillarForm.terjemahanText}
                            onChange={(v) =>
                              setPillarForm({
                                ...pillarForm,
                                terjemahanText: v,
                              })
                            }
                            disabled={isSavingPillar}
                            className="!mt-0 !rounded-xl !py-3 !px-4 !bg-slate-50/50 hover:!bg-white !border-slate-200 focus-within:!ring-4 focus-within:!ring-daw-green/10 focus-within:!border-daw-green transition-all"
                          />
                        </div>
                      </div>
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
