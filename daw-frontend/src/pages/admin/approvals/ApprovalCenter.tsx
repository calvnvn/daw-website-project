import {
  Check,
  X,
  Eye,
  Clock,
  FileText,
  Loader2,
  ShieldAlert,
  LayoutTemplate,
  Search,
  ChevronRight,
  AlertTriangle,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovals } from "./hooks/useApprovals";

import {
  getModuleLabel,
  getActionInfo,
  getHumanTargetName,
  timeAgo,
  getInitials,
} from "./utils/approvalHelpers";

import React, { Suspense } from "react";
const DiffModal = React.lazy(() => import("./components/DiffModal"));
// MAIN COMPONENT: APPROVAL CENTER
export default function ApprovalCenter() {
  const { can, user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const {
    isLoading,
    selectedDraft,
    setSelectedDraft,
    isSubmitting,
    selectedTickets,
    setSelectedTickets,
    isBulkApproving,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    totalPages,
    stats,
    filteredDrafts,
    paginatedDrafts,
    groupedDrafts,
    toggleTicketSelection,
    handleApprove,
    handleReject,
    handleBulkApprove,
    fetchApprovals,
  } = useApprovals({ canManage: can("manage_approvals"), isSuperadmin });

  if (!can("manage_approvals")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-red-500 min-h-[50vh]">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-black uppercase tracking-widest">
          Akses Terlarang
        </h2>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL TICKETS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Antrean
              </p>
              <h3 className="text-4xl font-serif font-black text-slate-800">
                {stats.total}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-500 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium flex items-center gap-1">
            <span className="text-blue-500 font-bold">{stats.myTurn}</span>{" "}
            tugas menunggu keputusan Anda
          </p>
        </div>

        {/* CARD 2: URGENT (DELETE) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">
                Persetujuan Hapus
              </p>
              <h3 className="text-4xl font-serif font-black text-rose-600">
                {stats.urgent}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium">
            Penghapusan data secara permanen.
          </p>
        </div>

        {/* CARD 3: AGING TICKETS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                Tertunda Lama
              </p>
              <h3 className="text-4xl font-serif font-black text-amber-600">
                {stats.aging}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium">
            Belum diputuskan lebih dari 3 hari.
          </p>
        </div>

        {/* CARD 4: GHOST TICKETS (Hanya Admin) */}
        {isSuperadmin && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Tiket Bermasalah
                </p>
                <h3 className="text-4xl font-serif font-black text-slate-700">
                  {stats.ghosts}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-red-500 mt-4 font-bold flex items-center gap-1">
              Gangguan sinkronisasi. Butuh bantuan IT.
            </p>
          </div>
        )}
      </div>

      {/* --- ACTION BAR (Tab & Search) --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* TAB NAVIGATION */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-fit">
          {[
            { id: "my_queue", label: "Tugas Anda" },
            { id: "history", label: "Riwayat" },
            ...(isSuperadmin ? [{ id: "all", label: "Semua Jalur" }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:flex-none px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* SEARCH & REFRESH */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Tiket atau Editor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={fetchApprovals}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-daw-green hover:text-white hover:border-daw-green rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Data">
            <Clock
              className={`w-5 h-5 ${isLoading ? "animate-spin text-daw-green" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          // SKELETON LOADER STATE
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="h-4 bg-slate-100 rounded w-1/4 mb-8 animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex gap-4 items-center animate-pulse border-b border-slate-50 pb-4 last:border-0">
                <div className="w-20 h-8 bg-slate-100 rounded-md"></div>
                <div className="w-64 h-4 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : paginatedDrafts.length === 0 ? (
          // EMPTY STATE
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-24 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-slate-50/50 border border-slate-100 shadow-inner">
              {searchQuery ? (
                <Search className="w-10 h-10 text-slate-300" />
              ) : (
                <Check className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {searchQuery ? "Tidak Ada Hasil" : "Antrean Bersih, Approver!"}
            </h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              {searchQuery
                ? `Pencarian "${searchQuery}" tidak ditemukan.`
                : "Semua draf telah dieksekusi."}
            </p>
          </div>
        ) : (
          // 🚀 THE CLUSTER RENDERER (Render per Modul)
          Object.entries(groupedDrafts).map(([moduleName, moduleDrafts]) => (
            <div
              key={moduleName}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
              {/* CLUSTER HEADER */}
              <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <LayoutTemplate className="w-4 h-4 text-slate-500" />
                  </div>
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                    MODUL:{" "}
                    <span className="text-daw-green">
                      {getModuleLabel(moduleName)}
                    </span>
                  </h3>
                </div>
                <span className="bg-white border border-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  {moduleDrafts.length} Draf
                </span>
              </div>

              {/* CLUSTER TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <tbody className="divide-y divide-slate-100">
                    {moduleDrafts.map((draft) => {
                      const isGhost = draft._isGhost;
                      // const isRejected = draft.status === "Rejected";
                      const isSelected = selectedTickets.has(draft.notrans);
                      const isActionable =
                        draft.isMyQueue &&
                        !isGhost &&
                        draft.action !== "DELETE"; // Delete gak boleh bulk

                      // 🎨 SEMANTIC ROW AURA (Visual Hierarchy)
                      const rowAura = isGhost
                        ? "border-l-4 border-l-slate-300 bg-slate-50/50 grayscale-[50%]"
                        : draft.action === "DELETE"
                          ? "border-l-4 border-l-rose-500 bg-rose-50/20"
                          : draft.action === "CREATE"
                            ? "border-l-4 border-l-emerald-500 hover:bg-slate-50"
                            : "border-l-4 border-l-blue-500 hover:bg-slate-50";

                      return (
                        <tr
                          key={draft.notrans}
                          className={`transition-all group ${rowAura} ${isSelected ? "bg-daw-green/5" : ""}`}>
                          {/* CHECKBOX UNTUK BULK ACTION */}
                          <td className="pl-6 py-4 w-10">
                            {isActionable ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleTicketSelection(draft.notrans)
                                }
                                className="w-5 h-5 rounded border-slate-300 text-daw-green focus:ring-daw-green/20 cursor-pointer transition-all"
                              />
                            ) : (
                              <div
                                className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 cursor-not-allowed opacity-50"
                                title="Tidak dapat dibulk"></div>
                            )}
                          </td>

                          {/* KOLOM 1: TIKET & BATON PASS HUD */}
                          <td className="px-4 py-4 w-1/3">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md shadow-sm ring-1 ring-slate-200/50 bg-white text-slate-700">
                                  {draft.notrans}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${getActionInfo(draft.action).bg} ${getActionInfo(draft.action).color}`}>
                                  {getActionInfo(draft.action).label}
                                </span>
                              </div>

                              {/* 🚀 THE BATON-PASS VISUALIZER */}
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold">
                                <span
                                  className="text-slate-400"
                                  title="Data diubah oleh pengaju konten">
                                  Pengaju
                                </span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                {isGhost ? (
                                  <span
                                    className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 animate-pulse"
                                    title="Terdapat ketidaksesuaian data dengan sistem utama">
                                    Bermasalah
                                  </span>
                                ) : draft.isMyQueue ? (
                                  <span
                                    className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm animate-pulse"
                                    title="Menunggu tinjauan dan keputusan Anda untuk tiket ini">
                                    Giliran Anda ⚡
                                  </span>
                                ) : draft.owlStatus === "1" ||
                                  draft.owlStatus === "2" ? (
                                  <span
                                    className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                    title="Anda telah menyetujui tiket ini">
                                    Selesai ✓
                                  </span>
                                ) : (
                                  <span
                                    className="text-slate-400"
                                    title="Menunggu persetujuan dari pihak lain sebelum giliran Anda">
                                    Menunggu
                                  </span>
                                )}
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span
                                  className="text-slate-400"
                                  title="Data akan terpublikasi secara otomatis setelah semua approver menyetujui">
                                  Terbitkan
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* KOLOM 2: TARGET IDENTIFIER */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span
                                className="text-sm font-bold text-slate-700 max-w-[220px] truncate"
                                title={
                                  isGhost
                                    ? "Draf Tidak Sinkron"
                                    : getHumanTargetName(draft)
                                }>
                                {isGhost
                                  ? "Draf Tidak Sinkron"
                                  : getHumanTargetName(draft)}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{" "}
                                {isGhost
                                  ? "Waktu tidak tersedia"
                                  : timeAgo(draft.createdAt)}
                              </span>
                            </div>
                          </td>

                          {/* KOLOM 3: SUBMITTER */}
                          <td className="px-6 py-4">
                            <div
                              className={`flex items-center gap-3 ${isGhost ? "opacity-50" : ""}`}>
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white ${isGhost ? "bg-slate-300" : "bg-gradient-to-br from-daw-green to-emerald-600"}`}>
                                {isGhost ? "?" : getInitials(draft.created_by)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700">
                                  {isGhost
                                    ? "System"
                                    : draft.created_by || "Editor Unknown"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Pengaju Konten
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* KOLOM 4: AKSI EKSKLUSIF */}
                          <td className="px-6 py-4 text-right pr-8">
                            {draft.isMyQueue ? (
                              <button
                                onClick={() => setSelectedDraft(draft)}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-daw-green text-white hover:bg-[#003b1c] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-daw-green/20 active:scale-95 transform hover:-translate-y-0.5">
                                Tinjau & Putuskan{" "}
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedDraft(draft)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-daw-green hover:border-daw-green hover:bg-daw-green/5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95">
                                <Eye className="w-4 h-4" /> Pantau
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SMART PAGINATION CONTROLS */}
      {!isLoading && filteredDrafts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">
            Menampilkan{" "}
            <span className="font-bold text-slate-700">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            hingga{" "}
            <span className="font-bold text-slate-700">
              {Math.min(currentPage * itemsPerPage, filteredDrafts.length)}
            </span>{" "}
            dari{" "}
            <span className="font-bold text-slate-700">
              {filteredDrafts.length}
            </span>{" "}
            tiket
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    Math.abs(page - currentPage) <= 2 ||
                    page === 1 ||
                    page === totalPages,
                )
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-2 text-slate-400 font-bold">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${currentPage === page ? "bg-daw-green text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {page}
                      </button>
                    </div>
                  );
                })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 🚀 FASE 3.3: FLOATING ACTION BAR (Untuk Bulk Action)         */}
      {selectedTickets.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selectedTickets.size} Tiket Terpilih
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Siap untuk dieksekusi massal
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700"></div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTickets(new Set())}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                Batal
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                className="px-6 py-2 bg-daw-green hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-daw-green/20 flex items-center gap-2 disabled:opacity-50">
                {isBulkApproving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIFF MODAL RENDERER */}
      {selectedDraft && !selectedDraft._isGhost && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
            </div>
          }>
          <DiffModal
            draft={selectedDraft}
            isReadOnly={!selectedDraft.isMyQueue}
            onClose={() => setSelectedDraft(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            isSubmitting={isSubmitting}
          />
        </Suspense>
      )}
    </div>
  );
}
