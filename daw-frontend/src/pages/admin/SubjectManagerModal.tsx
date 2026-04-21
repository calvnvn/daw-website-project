import { useState, useEffect, useCallback } from "react";
import {
  X,
  Mail,
  Link as LinkIcon,
  Send,
  Info,
  Save,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface SubjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

interface Subject {
  id: number;
  name: string;
  isActive: boolean;
  recipient_email: string | null;
  is_redirect: boolean;
  redirect_url: string | null;
}
export default function SubjectManagerModal({
  isOpen,
  onClose,
  onRefresh,
}: SubjectManagerModalProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [newSubject, setNewSubject] = useState({
    name: "",
    isActive: true,
    recipient_email: "" as string | null,
    is_redirect: false,
    redirect_url: "" as string | null,
  });

  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

  // 2. Bungkus fetchSubjects dengan useCallback agar stabil
  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/inquiries/subjects");
      setSubjects(res.data);
    } catch (error) {
      console.error("Failed to fetch subjects", error);
    }
  }, []); // Kosong karena tidak ada dependensi eksternal

  // 3. Update useEffect: Tambahkan fetchSubjects ke dependency array
  useEffect(() => {
    if (isOpen) {
      fetchSubjects();
    }
  }, [isOpen, fetchSubjects]);

  // 2. Logic: Menyimpan / Update Subject
  const handleSaveSubject = async () => {
    if (!newSubject.name.trim()) return toast.error("Nama subjek wajib diisi");

    // VALIDASI B (Client Side)
    if (newSubject.is_redirect) {
      const urlRegex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/;
      if (!newSubject.redirect_url || !urlRegex.test(newSubject.redirect_url)) {
        return toast.error("Masukkan URL redirect yang valid (https://...)");
      }
    } else if (newSubject.recipient_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newSubject.recipient_email)) {
        return toast.error("Format email departemen tidak valid");
      }
    }

    // SANITIZATION A (Data Bersih)
    const payload = {
      ...newSubject,
      name: newSubject.name.trim(),
      recipient_email: newSubject.is_redirect
        ? null
        : newSubject.recipient_email || null,
      redirect_url: newSubject.is_redirect ? newSubject.redirect_url : null,
    };

    try {
      const loadingToast = toast.loading("Saving subject setup...");
      if (editingSubjectId) {
        await api.put(`/inquiries/subjects/${editingSubjectId}`, payload);
        toast.success("Routing & Subject updated!", { id: loadingToast });
      } else {
        await api.post("/inquiries/subjects", payload);
        toast.success("New Subject routing activated!", { id: loadingToast });
      }

      // Reset
      setNewSubject({
        name: "",
        isActive: true,
        recipient_email: "",
        is_redirect: false,
        redirect_url: "",
      });
      setEditingSubjectId(null);
      fetchSubjects();
      onRefresh(); // Supaya tab di Inbox ikut ke-update
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to save subject setup",
      );
    }
  };

  // 3. Logic: Hapus Subjek
  const handleDelete = (id: number, name: string) => {
    toast(`Delete "${name}"?`, {
      description: "This will remove the routing logic and cannot be undone.",
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      action: {
        label: "Confirm Delete",
        onClick: async () => {
          const loadingToast = toast.loading(`Terminating ${name}...`);
          try {
            await api.delete(`/inquiries/subjects/${id}`);
            toast.success("Subject Deleted", { id: loadingToast });
            fetchSubjects();
            onRefresh();
          } catch (error: any) {
            toast.error("Delete Failed", { id: loadingToast });
          }
        },
      },
      cancel: { label: "Abort", onClick: () => {} },
    });
  };

  // 4. Render UI: Jika modal ditutup, return null agar tidak dirender di DOM
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-serif font-bold text-xl text-slate-900">
            Manage Inquiry Subjects
          </h2>
          <button
            onClick={() => {
              onClose();
              setEditingSubjectId(null);
              setNewSubject({
                name: "",
                isActive: true,
                recipient_email: "",
                is_redirect: false,
                redirect_url: "",
              });
            }}
            className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* KOTAK 1: THE SMART SWITCHER FORM */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner flex flex-col gap-5 transition-all duration-300">
            {/* Baris 1: Nama & Action Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Subject Name
                </label>
                <input
                  value={newSubject.name}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green outline-none transition-all bg-white shadow-sm"
                  placeholder="e.g. Careers & Internships"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Inquiry Action Type
                </label>
                <div className="flex p-1 bg-slate-200/50 rounded-lg border border-slate-200">
                  <button
                    onClick={() =>
                      setNewSubject({ ...newSubject, is_redirect: false })
                    }
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-300 ${
                      !newSubject.is_redirect
                        ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}>
                    <Mail className="w-3.5 h-3.5" /> Email Routing
                  </button>
                  <button
                    onClick={() =>
                      setNewSubject({ ...newSubject, is_redirect: true })
                    }
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-300 ${
                      newSubject.is_redirect
                        ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-700"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}>
                    <LinkIcon className="w-3.5 h-3.5" /> External Link
                  </button>
                </div>
              </div>
            </div>

            {/* Baris 2: Input Kondisional */}
            <div className="relative overflow-hidden transition-all duration-500">
              {!newSubject.is_redirect ? (
                <div className="space-y-1.5 animate-in slide-in-from-left-4 fade-in duration-300">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3 h-3 text-daw-green" /> Recipient
                    Department Email
                  </label>
                  <div className="relative">
                    <input
                      value={newSubject.recipient_email || ""}
                      onChange={(e) =>
                        setNewSubject({
                          ...newSubject,
                          recipient_email: e.target.value,
                        })
                      }
                      className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green outline-none transition-all bg-white shadow-sm"
                      placeholder="e.g. hr@dawgroup.com"
                    />
                    {!newSubject.recipient_email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 pointer-events-none">
                        <Info className="w-3 h-3" /> FALLBACK TO PRIMARY
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Kosongkan jika ingin pesan masuk ke email admin utama
                    perusahaan.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 animate-in slide-in-from-right-4 fade-in duration-300 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3 h-3" /> Redirect Target URL
                  </label>
                  <input
                    value={newSubject.redirect_url || ""}
                    onChange={(e) =>
                      setNewSubject({
                        ...newSubject,
                        redirect_url: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all bg-white shadow-sm font-mono text-blue-800"
                    placeholder="https://id.jobstreet.com/..."
                  />
                  <p className="text-[10px] text-blue-500 font-medium leading-relaxed">
                    Saat subjek ini dipilih, form "Contact Us" akan di-bypass
                    dan user akan diarahkan ke link di atas.
                  </p>
                </div>
              )}
            </div>

            {/* Baris 3: Footer (Status & Save Button) */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={newSubject.isActive}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-daw-green rounded border-slate-300 focus:ring-daw-green transition-all cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 group-hover:text-daw-green transition-colors">
                    Active Subject
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Tampilkan di dropdown website
                  </span>
                </div>
              </label>

              <button
                onClick={handleSaveSubject}
                className={`px-8 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md flex items-center gap-2 active:scale-95 ${
                  newSubject.is_redirect
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30"
                    : "bg-daw-green hover:bg-emerald-700 text-white shadow-emerald-500/30"
                }`}>
                {newSubject.is_redirect ? (
                  <LinkIcon className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {editingSubjectId ? "Update Subject Setup" : "Save New Subject"}
              </button>
            </div>
          </div>

          {/* KOTAK 2: TABLE LIST */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">Subject Name</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center py-6 text-slate-500 text-xs bg-white">
                      No subjects found. Add one above.
                    </td>
                  </tr>
                ) : (
                  subjects.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 transition-colors bg-white">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          {/* Ikon penanda visual di tabel */}
                          {s.is_redirect ? (
                            <LinkIcon
                              className="w-3 h-3 text-blue-500"
                              title="Redirect Link"
                            />
                          ) : (
                            <Mail
                              className="w-3 h-3 text-emerald-500"
                              title="Email Routing"
                            />
                          )}
                          {s.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                            s.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-400"
                          }`}>
                          {s.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-3">
                        <button
                          onClick={() => {
                            setNewSubject({
                              name: s.name,
                              isActive: s.isActive,
                              recipient_email: s.recipient_email || "",
                              is_redirect: !!s.is_redirect,
                              redirect_url: s.redirect_url || "",
                            });
                            setEditingSubjectId(s.id);
                          }}
                          className="text-daw-green font-medium hover:underline text-xs">
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="text-red-500 font-medium hover:underline text-xs">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
