/**
 * MODULE: Approval Center (Execution Machine)
 * PATH: /src/pages/admin/ApprovalCenter.tsx
 * * TECHNICAL DOCUMENTATION:
 * 1. Unified Fetching: Mengambil daftar draf dari ERP OWL.
 * 2. Visual Diffing: Menggunakan react-diff-viewer untuk mencegah "Blind Approval".
 * 3. Secure Execution: Memanggil /api/approval/decide dengan status 1 (Approve) atau 2 (Reject).
 */

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Check, X, Eye, Clock, FileText, Loader2 } from "lucide-react";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

// Tipe Data berdasarkan response ERP OWL
interface PendingDraft {
  notrans: string;
  module: string;
  action: string;
  targetId: string;
  keterangan: string; // Ini berisi string JSON (Payload Editor)
  karyawanid: string;
  tanggal: string; // Misal: "2026-04-13"
}

// Komponen Modal Detail Diff
const DiffModal = ({
  draft,
  onClose,
  onApprove,
  onReject,
}: {
  draft: PendingDraft;
  onClose: () => void;
  onApprove: (
    notrans: string,
    module: string,
    targetId: string,
    payload: any,
  ) => void;
  onReject: (notrans: string) => void;
}) => {
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const [oldData, setOldData] = useState<any>(null);
  const [loadingOld, setLoadingOld] = useState(true);

  useEffect(() => {
    const fetchOriginal = async () => {
      setLoadingOld(true);
      try {
        const response = await api.get("/approval/original-data", {
          params: {
            module: draft.module,
            targetId: draft.targetId,
          },
        });
        setOldData(response.data);
      } catch (error) {
        console.error("Gagal mengambil data live:", error);
        setOldData({
          error:
            "Data Live tidak ditemukan. Jika ini adalah request Create (Data Baru), abaikan pesan ini.",
        });
      } finally {
        setLoadingOld(false);
      }
    };

    if (draft) {
      fetchOriginal();
    }
  }, [draft]);

  // Parse JSON dari Keterangan
  const parsedPayload = useMemo(() => {
    try {
      return JSON.parse(draft.keterangan);
    } catch {
      return { error: "Gagal membaca data payload dari OWL." };
    }
  }, [draft.keterangan]);

  const finalPayload = parsedPayload.content || parsedPayload;
  const newContentStr = JSON.stringify(finalPayload, null, 2);
  const oldContentStr = loadingOld
    ? "Sedang mengambil data live dari server DAW..."
    : JSON.stringify(oldData || {}, null, 2);

  // Helper untuk mencari gambar di dalam payload agar bisa di-preview Admin
  const previewImage =
    finalPayload.cover_image ||
    finalPayload.photoUrl ||
    finalPayload.logoUrl ||
    finalPayload.heroImage;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Tinjau Revisi: {draft.module}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-mono uppercase">
              Tiket: {draft.notrans} | ID Target: {draft.targetId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* BODY MODAL: DIFF VIEWER */}
        <div className="flex-1 overflow-y-auto p-0 bg-[#f8f9fa]">
          {loadingOld && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-daw-green mb-2" />
              <p className="text-sm font-bold text-slate-600">
                Sinkronisasi Data Live...
              </p>
            </div>
          )}
          <ReactDiffViewer
            oldValue={oldContentStr}
            newValue={newContentStr}
            splitView={true}
            compareMethod={DiffMethod.WORDS}
            leftTitle="Data Saat Ini (Live)"
            rightTitle="Data Usulan (Draft Editor)"
            styles={{
              variables: {
                light: {
                  diffViewerBackground: "#fff",
                  addedBackground: "#e6ffed",
                  removedBackground: "#ffeef0",
                },
              },
            }}
          />
        </div>

        {/* EXTRA UX: PREVIEW GAMBAR JIKA ADA */}
        {previewImage && !loadingOld && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center gap-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
              Preview Asset:
            </span>
            <div className="h-12 w-auto bg-white border border-slate-200 rounded overflow-hidden p-1 shadow-sm">
              <img
                src={
                  previewImage.startsWith("data:")
                    ? previewImage
                    : `${BASE_UPLOAD_URL}/${previewImage}`
                }
                alt="Preview"
                className="h-full w-auto object-contain"
              />
            </div>
          </div>
        )}

        {/* FOOTER MODAL: ACTIONS */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Action Tolak */}
          <div className="flex-1 flex gap-2 w-full sm:w-auto">
            {isRejecting ? (
              <div className="flex w-full gap-2 animate-in slide-in-from-left-2">
                <input
                  type="text"
                  placeholder="Alasan penolakan..."
                  className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  onClick={() => onReject(draft.notrans)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Kirim Penolakan
                </button>
                <button
                  onClick={() => setIsRejecting(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-lg"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsRejecting(true)}
                className="px-6 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Tolak Revisi
              </button>
            )}
          </div>

          {/* Action Setuju */}
          {!isRejecting && (
            <button
              onClick={() =>
                onApprove(
                  draft.notrans,
                  draft.module,
                  draft.targetId,
                  finalPayload,
                )
              }
              disabled={loadingOld}
              className="px-6 py-2.5 bg-daw-green hover:bg-[#003b1c] text-white text-sm font-bold rounded-lg transition-all active:scale-95 flex items-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" /> Setujui & Eksekusi (Live)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// MAIN COMPONENT
export default function ApprovalCenter() {
  const { can } = useAuth();
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<PendingDraft | null>(null);

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/approval/list");
      // console.log("FULL API RESPONSE:", response.data);
      const rows = response.data?.data?.rows;

      if (Array.isArray(rows)) {
        setDrafts(rows);
      } else {
        setDrafts([]);
      }
    } catch {
      setDrafts([]);
      toast.error("Gagal sinkronisasi dengan ERP.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (can("manage_approvals")) {
      fetchApprovals();
    }
  }, [can]);

  // ACTION: EKSEKUSI APPROVE
  const handleApprove = async (
    notrans: string,
    module: string,
    targetId: string,
    payload: any,
  ) => {
    const toastId = toast.loading("Mengeksekusi persetujuan ke server...");
    try {
      await api.post("/approval/decide", {
        notrans,
        status: "1", // 1 = Approve di sistem DAW
        module,
        targetId,
        payload,
      });
      toast.success(`Draf ${module} berhasil dieksekusi ke Production!`, {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals(); // Refresh tabel
    } catch (error: any) {
      toast.error("Eksekusi gagal", {
        description: error.response?.data?.message || "Kesalahan server.",
        id: toastId,
      });
    }
  };

  // ACTION: EKSEKUSI REJECT
  const handleReject = async (notrans: string) => {
    const toastId = toast.loading("Mengirim penolakan...");
    try {
      await api.post("/approval/decide", {
        notrans,
        status: "2", // 2 = Reject
        keteranganRejek: "Ditolak oleh Admin/Mas Umar",
      });
      toast.success("Draf berhasil ditolak dan dihapus dari antrean.", {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals();
    } catch {
      toast.error("Gagal menolak draf", { id: toastId });
    }
  };

  if (!can("manage_approvals")) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Akses Ditolak. Anda bukan Admin.
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6">
      {/* HEADER PAGE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
            Approval Center
            <span className="bg-daw-green/10 text-daw-green text-xs px-2 py-1 rounded-md font-sans ml-2">
              {drafts.length} Pending
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pusat kontrol untuk meninjau dan mengeksekusi revisi dari Editor.
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-slate-200"
        >
          <Clock className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />{" "}
          Refresh Antrean
        </button>
      </div>

      {/* TABLE QUEUE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-daw-green mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">
              Sinkronisasi dengan Server...
            </p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-daw-green" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Antrean Bersih!
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Tidak ada draf yang menunggu persetujuan Anda saat ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider font-black text-slate-500">
                  <th className="px-6 py-4">No. Tiket</th>
                  <th className="px-6 py-4">Modul</th>
                  <th className="px-6 py-4">Aksi / ID Target</th>
                  <th className="px-6 py-4">Tanggal Pengajuan</th>
                  <th className="px-6 py-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.isArray(drafts) &&
                  drafts.map((draft) => (
                    <tr
                      key={draft.notrans}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-mono text-sm text-slate-600">
                        {draft.notrans}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-600">
                          <FileText className="w-3.5 h-3.5" /> {draft.module}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-800">
                          {draft.action}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {draft.targetId}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {draft.tanggal}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedDraft(draft)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-daw-green hover:text-daw-green text-sm font-bold rounded-lg transition-all shadow-sm group-hover:shadow-md flex items-center justify-center gap-2 w-full sm:w-auto ml-auto"
                        >
                          <Eye className="w-4 h-4" /> Tinjau
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENDER MODAL */}
      {selectedDraft && (
        <DiffModal
          draft={selectedDraft}
          onClose={() => setSelectedDraft(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
