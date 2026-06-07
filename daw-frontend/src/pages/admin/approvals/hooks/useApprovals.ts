import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { ApprovalDraft } from "../utils/approvalHelpers";
import { getErrorMessage } from "@/lib/utils";

interface UseApprovalsOptions {
  canManage: boolean;
  isSuperadmin: boolean;
}

export function useApprovals({ canManage }: UseApprovalsOptions) {
  // SYSTEM STATES (Data Fetching & Modals)
  const [drafts, setDrafts] = useState<ApprovalDraft[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, urgent: 0, aging: 0, ghosts: 0, myTurn: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // POWER STATES
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // ENGINE STATES (Search, Filter, Pagination)
  const [activeTab, setActiveTab] = useState<"my_queue" | "history" | "all">(
    "my_queue", // Change default if needed or keep "all" depending on requirements
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedTickets(new Set());
  }, [activeTab, searchQuery]);

  // API FETCHING
  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/approval/list", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          tab: activeTab,
          search: searchQuery
        }
      });
      const resData = response.data;
      if (resData && resData.data) {
        setDrafts(resData.data);
        setTotalPages(resData.totalPages || 1);
        if (resData.stats) setStats(resData.stats);
      } else {
        setDrafts(Array.isArray(resData) ? resData : []);
      }
    } catch {
      setDrafts([]);
      toast.error("Gagal menarik data antrean dari server DAW.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      fetchApprovals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, currentPage, activeTab, searchQuery]);

  useEffect(() => {
    if (!isLoading && drafts.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const ticketQuery = searchParams.get("ticket");

      if (ticketQuery) {
        const targetDraft = drafts.find(
          (d) => d.notrans.toLowerCase() === ticketQuery.toLowerCase(),
        );

        if (targetDraft) {
          setSelectedDraft(targetDraft);
          toast.success("Tiket Ditemukan!", {
            description: `Membuka draf ${targetDraft.notrans} secara otomatis.`,
          });
        } else {
          toast.error("Tiket Tidak Ditemukan", {
            description: `Draf ${ticketQuery} tidak ada di antrean Anda saat ini.`,
          });
        }

        const newUrl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, [isLoading, drafts]);



  // SELECTION TOGGLE (Untuk Bulk Action)
  const toggleTicketSelection = (notrans: string) => {
    setSelectedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notrans)) newSet.delete(notrans);
      else newSet.add(notrans);
      return newSet;
    });
  };

  // ACTION HANDLERS
  const handleApprove = async (draft: ApprovalDraft) => {
    if (!draft.nourut || !draft.kodeapp) {
      return toast.error(
        "Identitas baris ERP (nourut/kodeapp) hilang. Coba refresh antrean.",
      );
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Mengeksekusi persetujuan & sinkronisasi...");

    try {
      await api.post("/approval/decide", {
        status: "1",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
      });

      toast.success(`Draf ${draft.module_name} berhasil disetujui!`, {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals();
    } catch (error: unknown) {
      toast.error("Eksekusi gagal", {
        description: getErrorMessage(error) || "Kesalahan internal server.",
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (draft: ApprovalDraft, reason: string) => {
    if (!reason.trim() || reason.length < 5) {
      return toast.error("Wajib isi alasan penolakan yang jelas.");
    }

    if (draft._isGhost) {
      return toast.error("Tiket Missmatch Terdeteksi", {
        description:
          "Data lokal telah terhapus. Hubungi Tim IT untuk membersihkan antrean ini.",
      });
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Mengirim keputusan penolakan...");

    try {
      await api.post("/approval/decide", {
        status: "2",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
        komentar: reason,
      });

      toast.success("Revisi ditolak. Data telah dikembalikan ke Editor.", {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals();
    } catch (err: unknown) {
      toast.error("Gagal mengirim penolakan", {
        description: getErrorMessage(err) || "Kesalahan internal.",
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedTickets.size === 0) return;

    setIsBulkApproving(true);
    const toastId = toast.loading(
      `Mengeksekusi ${selectedTickets.size} persetujuan massal...`,
    );

    const targets = drafts.filter((d) => selectedTickets.has(d.notrans));


    const promises = targets.map((draft) =>
      api.post("/approval/decide", {
        status: "1",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
      }),
    );

    const results = await Promise.allSettled(promises);
    let successCount = 0;
    const failedTickets = new Set<string>();

    results.forEach((result, index) => {
      const draft = targets[index];
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failedTickets.add(draft.notrans);
      }
    });

    if (failedTickets.size === 0) {
      toast.success(`${successCount} draf berhasil disetujui massal!`, {
        id: toastId,
      });
      setSelectedTickets(new Set()); // Bersihkan hanya jika semua sukses
    } else {
      toast.warning(
        `${successCount} berhasil, ${failedTickets.size} gagal. Silakan coba lagi untuk tiket yang gagal.`,
        { id: toastId },
      );
      setSelectedTickets(failedTickets); // Biarkan tiket yang gagal tetap terseleksi
    }

    setIsBulkApproving(false);
    fetchApprovals();
  };

  // DERIVED DATA PIPELINE
  const filteredDrafts = drafts;
  const paginatedDrafts = drafts;

  const groupedDrafts = useMemo(() => {
    const groups: Record<string, ApprovalDraft[]> = {};
    paginatedDrafts.forEach((draft) => {
      const modName = draft.module_name || "UNKNOWN_MODULE";
      if (!groups[modName]) groups[modName] = [];
      groups[modName].push(draft);
    });
    return groups;
  }, [paginatedDrafts]);

  return {
    drafts,
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
  };
}
