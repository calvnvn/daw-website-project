import React, { useState, useRef, useMemo } from "react";
import {
  Lock,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  RotateCcw,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAbout } from "@/contexts/AboutContext";
import type { ManagementItem as ManagementMember } from "@/contexts/AboutContext";
import { PhotoPreviewer, ManagementImage } from "../AboutSharedComponents";

interface ManagementTabProps {
  isEditing: boolean;
  isSuperadmin: boolean;
  isEditor: boolean;
}

export default function ManagementTab({
  isEditing,
  isSuperadmin,
  isEditor,
}: ManagementTabProps) {
  const { managementTeam, refreshData } = useAbout();

  // MODAL & FORM STATES
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

  // THE DRAFT & SYSTEM STATES
  const [isSaving, setIsSaving] = useState(false);
  const [, setIsDiscarding] = useState(false);
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [personForm, setPersonForm] = useState({
    name: "",
    role: "",
    description: "",
    level: "division",
    order: 1,
    photo: null as File | null,
    removePhoto: false,
    savedPhotoUrl: null as string | null,
    previous_notrans: null as string | null,
    originalSnapshot: null as string | null,
  });

  const openPersonModal = async (person: ManagementMember | null = null) => {
    if (person?.is_locked && !person?.hasRejected && !isSuperadmin) {
      return toast.warning("Akses Dibatasi", {
        description: "Data profil ini sedang ditinjau dan tidak dapat diubah.",
      });
    }

    let draftData = null;

    if (person?.hasRejected && isEditor) {
      setIsLoadingDraft(true); // Tahan UI modal
      const toastId = toast.loading("Menarik catatan revisi...");
      try {
        const res = await api.get(
          `/approval/rejected/${person.id}?module=Management`,
        );
        draftData = res.data?.data;
        setRejectedDraft(draftData);
        toast.dismiss(toastId);
      } catch (err) {
        toast.error("Gagal menarik catatan revisi", { id: toastId });
      } finally {
        setIsLoadingDraft(false);
      }
    } else {
      setRejectedDraft(null);
    }

    if (person) {
      setEditingPersonId(person.id);

      let safePayload = null;
      if (draftData?.payload) {
        try {
          safePayload =
            typeof draftData.payload === "string"
              ? JSON.parse(draftData.payload)
              : draftData.payload;
        } catch (e) {
          console.error("Gagal parse draf management", e);
        }
      }

      setPersonForm({
        name: safePayload?.name ?? person.name,
        role: safePayload?.role ?? person.role,
        description: safePayload?.description ?? person.description,
        level: safePayload?.level ?? person.level,
        order: safePayload?.order ?? person.order,
        photo: null,
        removePhoto: false,
        savedPhotoUrl: person.photoUrl,
        previous_notrans: draftData?.notrans || null,
        originalSnapshot: JSON.stringify({
          name: person.name,
          role: person.role,
          description: person.description,
          level: person.level,
          order: person.order,
          photoUrl: person.photoUrl, // Kita lacak photoUrl lama untuk Diff
        }),
      });
    } else {
      setEditingPersonId(null);
      setPersonForm({
        name: "",
        role: "",
        description: "",
        level: "division",
        order: managementTeam.length + 1, // Default ke urutan terakhir
        photo: null,
        removePhoto: false,
        savedPhotoUrl: null,
        previous_notrans: null,
        originalSnapshot: null,
      });
    }

    setIsPersonModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPersonForm((prev) => ({ ...prev, photo: file, removePhoto: false }));
    }
  };

  // THE DIFF ENGINE (Blueprint 2.2)
  const hasDataChanged = useMemo(() => {
    if (!editingPersonId) return true; // Data Baru pasti berubah
    if (!personForm.originalSnapshot) return true;

    if (personForm.photo || personForm.removePhoto) return true;

    const currentData = {
      name: personForm.name.trim(),
      role: personForm.role.trim(),
      description: personForm.description.trim(),
      level: personForm.level,
      order: personForm.order,
      photoUrl: personForm.savedPhotoUrl,
    };

    return JSON.stringify(currentData) !== personForm.originalSnapshot;
  }, [personForm, editingPersonId]);

  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return;

    if (
      hasDataChanged &&
      !window.confirm(
        "Perubahan ketikan Anda akan ditimpa oleh data draf. Lanjutkan?",
      )
    ) {
      return;
    }

    try {
      const payload =
        typeof rejectedDraft.payload === "string"
          ? JSON.parse(rejectedDraft.payload)
          : rejectedDraft.payload;

      setPersonForm((prev) => ({
        ...prev,
        name: payload.name ?? prev.name,
        role: payload.role ?? prev.role,
        description: payload.description ?? prev.description,
        level: payload.level ?? prev.level,
        order: payload.order ?? prev.order,
        removePhoto: false,
      }));

      toast.success("Data teks dipulihkan dari draf!");
    } catch {
      toast.error("Gagal membaca struktur draf.");
    }
  };

  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;

    setIsDiscarding(true);
    const loadingToast = toast.loading("Membersihkan notifikasi...");

    try {
      // PERHATIKAN: Method PATCH, bukan DELETE!
      await api.patch(
        `/approval/discard/${encodeURIComponent(rejectedDraft.notrans)}`,
      );

      setRejectedDraft(null);
      await refreshData();
      toast.success("Notifikasi berhasil dibersihkan.", { id: loadingToast });
      setIsPersonModalOpen(false); // Tutup modal setelah dibuang
    } catch {
      toast.error("Gagal membersihkan notifikasi.", { id: loadingToast });
    } finally {
      setIsDiscarding(false);
    }
  };

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !personForm.name.trim() ||
      !personForm.role.trim() ||
      !personForm.description.trim()
    ) {
      return toast.error(
        "Lengkapi semua kolom wajib (Nama, Peran, Deskripsi).",
      );
    }

    if (!hasDataChanged) {
      return toast.info("Tidak ada perubahan yang perlu disimpan.");
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan perubahan..." : "Menyimpan data...",
    );

    const formData = new FormData();
    formData.append("name", personForm.name.trim());
    formData.append("role", personForm.role.trim());
    formData.append("description", personForm.description.trim());
    formData.append("level", personForm.level);
    formData.append("order", personForm.order.toString());
    formData.append("status", isSuperadmin ? "Active" : "Published");

    if (personForm.removePhoto) formData.append("removePhoto", "true");
    if (personForm.photo) formData.append("photo", personForm.photo);
    if (isEditor && personForm.previous_notrans) {
      formData.append("previous_notrans", personForm.previous_notrans);
    }

    try {
      if (editingPersonId) {
        await api.put(`/management/${editingPersonId}`, formData, {
          timeout: 60000,
        });
      } else {
        await api.post("/management", formData, { timeout: 60000 });
      }

      await refreshData();
      toast.success(
        isSuperadmin ? "Profil diperbarui!" : "Draf tim diajukan!",
        { id: loadingToast },
      );
      setIsPersonModalOpen(false);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Terjadi kesalahan sistem.",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deletePerson = async (id: number) => {
    toast("Konfirmasi Hapus", {
      description: "Anda yakin ingin menghapus data anggota ini?",
      action: {
        label: "Hapus",
        onClick: async () => {
          const loadingToast = toast.loading("Memproses...");
          try {
            await api.delete(`/management/${id}`, { timeout: 60000 });
            await refreshData();
            toast.success(
              isEditor ? "Pengajuan hapus dikirim!" : "Anggota dihapus!",
              { id: loadingToast },
            );
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menghapus", {
              id: loadingToast,
            });
          }
        },
      },
    });
  };
  // RENDER
  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      {/* HEADER & ADD BUTTON */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Board of Directors & Management
          </h3>
          <p className="text-sm text-slate-500">
            Atur data direksi, jabatan, serta foto profil resmi.
          </p>
        </div>
        {isEditing && (
          <button
            onClick={() => openPersonModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg text-sm font-bold transition-colors shadow-sm active:scale-95">
            <Plus className="w-4 h-4" /> Add Person
          </button>
        )}
      </div>

      {/* TABLE LIST */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
              <th className="px-6 py-4">Photo</th>
              <th className="px-6 py-4">Name & Role</th>
              <th className="px-6 py-4">Level (Order)</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {managementTeam.map((person) => {
              const isRowLocked =
                person.is_locked && !person.hasRejected && !isSuperadmin;
              const lockStyles =
                "opacity-60 grayscale-[30%] bg-slate-50 pointer-events-none select-none";

              return (
                <tr
                  key={person.id}
                  className={`transition-colors ${isRowLocked ? lockStyles : "hover:bg-slate-50/50"}`}>
                  <td className="px-6 py-4">
                    <ManagementImage src={person.photoUrl} alt={person.name} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {person.name}
                      </p>
                      {person.hasRejected && !isSuperadmin && (
                        <span
                          title="Draf perlu direvisi"
                          className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white"
                        />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{person.role}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                      {person.level} ({person.order})
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isRowLocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 uppercase tracking-widest">
                        <Lock className="w-3 h-3" /> Terkunci
                      </span>
                    ) : isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openPersonModal(person)}
                          className={`p-2 rounded-lg transition-colors border ${
                            person.hasRejected
                              ? "text-red-600 bg-red-50 border-red-200 hover:bg-red-100"
                              : "text-slate-400 bg-white border-slate-200 hover:text-daw-green hover:border-daw-green"
                          }`}
                          title={
                            person.hasRejected ? "Revisi Draf" : "Edit Data"
                          }>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePerson(person.id)}
                          className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 hover:border-red-600 rounded-lg transition-colors"
                          title="Ajukan Hapus">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic flex justify-end">
                        Mode Baca
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {managementTeam.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200 bg-slate-50">
                  Belum ada data kepemimpinan. <br /> Klik <b>'Add Person'</b>{" "}
                  untuk memulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ==========================================
          MODAL: CREATE / EDIT PERSON
          ========================================== */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* MODAL HEADER */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {editingPersonId ? (
                  <Edit className="w-5 h-5 text-daw-green" />
                ) : (
                  <Plus className="w-5 h-5 text-daw-green" />
                )}
                {editingPersonId
                  ? "Edit Profil Kepemimpinan"
                  : "Tambah Anggota Baru"}
              </h3>
              <button
                onClick={() => setIsPersonModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors">
                ✕
              </button>
            </div>

            {/* REJECTION RIBBON (Didalam Modal) */}
            {rejectedDraft && (
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
                      {rejectedDraft.rejection_reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {rejectedDraft.action !== "DELETE" && (
                        <button
                          onClick={handleRestoreDraft}
                          type="button"
                          className="text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm active:scale-95">
                          <RotateCcw className="w-3 h-3" /> PULIHKAN DATA
                        </button>
                      )}
                      <button
                        onClick={handleDiscardDraft}
                        type="button"
                        className="text-[10px] font-bold bg-white text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm active:scale-95">
                        <X className="w-3 h-3" /> ABAIKAN NOTIFIKASI
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL FORM (Scrollable area) */}
            <div className="overflow-y-auto p-6">
              <form
                id="management-form"
                onSubmit={savePerson}
                className="space-y-6">
                {isLoadingDraft ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-daw-green animate-spin" />
                    <p className="text-sm font-bold text-slate-500 animate-pulse">
                      Menarik catatan draf...
                    </p>
                  </div>
                ) : rejectedDraft?.action === "DELETE" ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-sm text-red-600 font-medium">
                      Tidak dapat mengedit data saat pengajuan hapus sedang
                      ditolak. <br />
                      Abaikan notifikasi di atas terlebih dahulu.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Full Name
                        </label>
                        <input
                          required
                          type="text"
                          value={personForm.name}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              name: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Job Title / Role
                        </label>
                        <input
                          required
                          type="text"
                          value={personForm.role}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              role: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Tingkat Jabatan
                        </label>
                        <select
                          value={personForm.level}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              level: e.target.value as any,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all bg-white text-sm">
                          <option value="chairman">Chairman</option>
                          <option value="director">Director</option>
                          <option value="division">Division Head</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Urutan Tampilan
                        </label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={personForm.order}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              order: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Description / Bio
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={personForm.description}
                        onChange={(e) =>
                          setPersonForm({
                            ...personForm,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green resize-none transition-all text-sm"
                      />
                    </div>

                    {/* PHOTO UPLOAD AREA */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Profile Photo (Opsional)
                      </label>
                      <div className="flex items-center gap-5 p-4 border border-slate-100 bg-slate-50/50 rounded-xl">
                        <PhotoPreviewer
                          file={personForm.photo}
                          savedUrl={
                            personForm.removePhoto
                              ? null
                              : personForm.savedPhotoUrl
                          }
                        />

                        <div className="flex flex-col gap-3 w-full">
                          <input
                            type="file"
                            accept="image/jpeg, image/png, image/webp"
                            ref={fileInputRef}
                            onChange={handlePhotoChange}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-daw-green/10 file:text-daw-green hover:file:bg-daw-green/20 transition-colors cursor-pointer"
                          />
                          {(personForm.photo ||
                            (personForm.savedPhotoUrl &&
                              !personForm.removePhoto)) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPersonForm({
                                  ...personForm,
                                  photo: null,
                                  removePhoto: true,
                                });
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                              }}
                              className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 w-max px-3 py-1.5 rounded-md transition-colors flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Foto Saat
                              Ini
                            </button>
                          )}
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
                onClick={() => setIsPersonModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              {rejectedDraft?.action !== "DELETE" && (
                <button
                  form="management-form"
                  type="submit"
                  disabled={isSaving || !hasDataChanged}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
                    isSaving
                      ? "bg-slate-300 text-slate-700"
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
