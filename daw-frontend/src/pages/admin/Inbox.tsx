import { useState, useEffect } from "react";
import {
  Search,
  Mail,
  MailOpen,
  Trash2,
  CheckCircle2,
  Clock,
  Phone,
  Building,
  CheckSquare,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface Inquiry {
  id: number;
  name: string;
  email: string;
  phone?: string; // null/undefined
  company?: string; // null/undefined
  subject?: string; // null/undefined
  message: string;
  isRead: boolean;
  createdAt: string; // Database Sequelize
}

export default function Inbox() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("All");
  const [selectedMails, setSelectedMails] = useState<number[]>([]);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({
    name: "",
    isActive: true,
  });
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);

  // FETCH MASTER SUBJECTS
  const fetchSubjects = async () => {
    try {
      const res = await api.get("/inquiries/subjects");
      setSubjects(res.data);
    } catch (error) {
      console.error("Failed to fetch subjects", error);
    }
  };

  const copyEmailToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Alamat email berhasil disalin!");
  };
  const openWebMail = (provider: "gmail" | "outlook" | "default") => {
    if (!selectedInquiry) return;

    const email = selectedInquiry.email;
    const subject = encodeURIComponent("Reply from Dharma Agung Wijaya");

    // Link khusus untuk direct compose
    const urls = {
      gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}`,
      outlook: `https://outlook.office.com/mail/deeplink/compose?to=${email}&subject=${subject}`,
      default: `mailto:${email}?subject=${subject}`,
    };

    window.open(urls[provider], "_blank");
  };

  // FETCH DATA DARI DATABASE
  useEffect(() => {
    const fetchInquiries = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/inquiries");
        const data = response.data;
        setInquiries(data);
        if (data.length > 0 && !selectedInquiryId) {
          setSelectedInquiryId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch inquiries", error);
        toast.error("Session expired or server error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInquiries();
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInquiries = inquiries.filter((inq) => {
    const matchesSearch =
      inq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inq.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterSubject === "All" || inq.subject === filterSubject;
    return matchesSearch && matchesFilter;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedMails(filteredInquiries.map((inq) => inq.id));
    } else {
      setSelectedMails([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedMails((prev) =>
      prev.includes(id)
        ? prev.filter((mailId) => mailId !== id)
        : [...prev, id],
    );
  };

  const bulkDelete = () => {
    if (selectedMails.length === 0) return;

    toast("Confirm Bulk Deletion", {
      description: `Are you sure you want to delete ${selectedMails.length} messages?`,
      action: {
        label: "Yes, Delete",
        onClick: () => executeBulkDelete(), // Jalankan eksekusi jika diklik
      },
      cancel: {
        label: "Cancel",
        onClick: () => {}, // Tutup toast tanpa aksi
      },
    });
  };

  // Fungsi Eksekutor: Menangani API Call (Ghost-Free)
  const executeBulkDelete = async () => {
    const loadingToast = toast.loading(
      `Deleting ${selectedMails.length} messages...`,
    );

    try {
      // Eksekusi paralel lewat instance 'api'
      const deletePromises = selectedMails.map((id) =>
        api.delete(`/inquiries/${id}`),
      );
      await Promise.all(deletePromises);

      // Update state lokal
      setInquiries((prev) =>
        prev.filter((inq) => !selectedMails.includes(inq.id)),
      );

      toast.success("Messages deleted permanently!", { id: loadingToast });
      setSelectedMails([]); // Reset centangan
      setSelectedInquiryId(null);
    } catch (err: any) {
      console.error("Bulk delete error", err);
      toast.error(err.response?.data?.message || "Failed to delete messages.", {
        id: loadingToast,
      });
    }
  };

  const selectedInquiry = inquiries.find((inq) => inq.id === selectedInquiryId);
  const unreadCount = inquiries.filter((inq) => !inq.isRead).length;

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/inquiries/${id}/read`);
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, isRead: true } : inq)),
      );
    } catch (error) {
      console.error("Failed to update read status", error);
    }
  };

  const deleteInquiry = (id: number) => {
    // Langsung panggil toast konfirmasi dari Sonner
    toast("Delete Message", {
      description: "Are you sure you want to delete this message permanently?",
      action: {
        label: "Yes, Delete",
        onClick: () => executeDelete(id), // Lempar ID ke eksekutor
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  // 2. Fungsi Eksekutor (The Logic)
  const executeDelete = async (id: number) => {
    const loadingToast = toast.loading("Deleting message...");

    try {
      await api.delete(`/inquiries/${id}`);

      const newInquiries = inquiries.filter((inq) => inq.id !== id);
      setInquiries(newInquiries);

      if (selectedInquiryId === id) {
        setSelectedInquiryId(
          newInquiries.length > 0 ? newInquiries[0].id : null,
        );
      }

      toast.success("Message deleted!", { id: loadingToast });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.response?.data?.message || "Failed to delete message", {
        id: loadingToast,
      });
    }
  };
  const handleSelectInquiry = (id: number) => {
    setSelectedInquiryId(id);
    const inq = inquiries.find((i) => i.id === id);
    if (inq && !inq.isRead) markAsRead(id);
  };

  // Format Tanggal
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900">
              Contact Inquiries
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola pesan yang diterima melalui formulir Hubungi Kami.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSubjectModalOpen(true)}
              className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <CheckSquare className="w-4 h-4" /> Manage Subjects
            </button>
            <div className="bg-daw-green/10 text-daw-green px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" /> {unreadCount} Unread
            </div>
          </div>
        </div>

        {/* SPLIT PANE LAYOUT */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px] h-[calc(100vh-200px)] max-h-[700px]">
          {/* LEFT: LIST */}
          <div className="w-full md:w-[350px] lg:w-[400px] border-r border-slate-200 flex flex-col shrink-0 bg-white">
            {/* SEARCH & BULK ACTION BAR */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search messages..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-sm transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* FILTER TABS */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                <button
                  onClick={() => setFilterSubject("All")}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors ${filterSubject === "All" ? "bg-daw-green text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  All
                </button>
                {subjects
                  .filter((s) => s.isActive)
                  .map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setFilterSubject(sub.name)}
                      className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors ${
                        filterSubject === sub.name
                          ? "bg-daw-green text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}{" "}
              </div>
            </div>

            {/* SELECT ALL BAR */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-daw-green rounded border-slate-300 focus:ring-daw-green cursor-pointer"
                  onChange={handleSelectAll}
                  checked={
                    filteredInquiries.length > 0 &&
                    selectedMails.length === filteredInquiries.length
                  }
                />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Select All Messages
                </span>
              </div>
            </div>

            {/* BULK ACTION PANEL */}
            {selectedMails.length > 0 && (
              <div className="bg-daw-green/10 px-4 py-3 flex justify-between items-center border-b border-daw-green/20 animate-in slide-in-from-top-2">
                <span className="text-xs font-bold text-daw-green">
                  {selectedMails.length} Selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedMails([])}
                    className="p-1.5 text-daw-green hover:bg-daw-green/20 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={bulkDelete}
                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* LIST AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="animate-pulse flex gap-3">
                      <div className="w-4 h-4 bg-slate-200 rounded shrink-0 mt-1"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-50 rounded w-full mt-2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredInquiries.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className={`flex items-start p-4 transition-colors hover:bg-slate-50 group relative cursor-pointer ${selectedInquiryId === inq.id ? "bg-green-50/50" : ""}`}
                      onClick={() => handleSelectInquiry(inq.id)}
                    >
                      {selectedInquiryId === inq.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-daw-green"></div>
                      )}
                      <div
                        className="shrink-0 mr-3 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMails.includes(inq.id)}
                          onChange={() => handleSelectOne(inq.id)}
                          className="w-4 h-4 text-daw-green rounded border-slate-300 focus:ring-daw-green cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3
                            className={`text-sm truncate pr-4 ${!inq.isRead ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                          >
                            {inq.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                            {formatDate(inq.createdAt)}
                          </span>
                        </div>
                        <h4
                          className={`text-xs truncate mb-1 ${!inq.isRead ? "font-semibold text-slate-800" : "text-slate-500"}`}
                        >
                          {inq.subject || "General Inquiry"}
                        </h4>
                        <p
                          className={`text-xs line-clamp-2 ${!inq.isRead ? "text-slate-600 font-medium" : "text-slate-400"}`}
                        >
                          {inq.message}
                        </p>
                      </div>
                      {!inq.isRead && (
                        <div className="shrink-0 w-2 h-2 bg-daw-green rounded-full ml-3 mt-1.5"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-12 h-full">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <CheckSquare className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    Inbox is Clear
                  </h3>
                  <p className="text-xs text-slate-500">
                    {searchTerm || filterSubject !== "All"
                      ? "No messages match your filter."
                      : "You have read all your messages. Great job!"}
                  </p>
                  {(searchTerm || filterSubject !== "All") && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setFilterSubject("All");
                      }}
                      className="mt-4 text-xs font-bold text-daw-green hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: DETAIL */}
          <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden">
            {selectedInquiry ? (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-2 text-slate-500">
                    {selectedInquiry.isRead ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-slate-100 rounded-md">
                        <MailOpen className="w-3.5 h-3.5" /> Read
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-daw-green/10 text-daw-green rounded-md">
                        <Mail className="w-3.5 h-3.5" /> Unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => markAsRead(selectedInquiry.id)}
                      className="p-2 text-slate-400 hover:text-daw-green hover:bg-green-50 rounded-lg transition-colors"
                      title="Mark as Read"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteInquiry(selectedInquiry.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 custom-scrollbar bg-slate-50/30">
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-daw-green/5 rounded-full blur-2xl group-hover:bg-daw-green/10 transition-colors duration-500 pointer-events-none"></div>
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                        <div className="space-y-4 flex-1">
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 font-bold uppercase tracking-wider rounded-md border border-slate-200">
                              {selectedInquiry.subject || "General Inquiry"}
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                              <Clock className="w-3.5 h-3.5" />{" "}
                              {formatDate(selectedInquiry.createdAt)}
                            </span>
                          </div>
                          <h2 className="text-2xl md:text-3xl font-serif font-black text-slate-900 tracking-tight">
                            {selectedInquiry.name}
                          </h2>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                            <button
                              onClick={() =>
                                copyEmailToClipboard(selectedInquiry.email)
                              }
                              className="flex items-center gap-2 text-slate-600 hover:text-daw-green font-medium transition-colors group/copy"
                              title="Click to copy email"
                            >
                              <div className="p-1.5 bg-slate-100 rounded-md group-hover/copy:bg-daw-green/10 transition-colors">
                                <Mail className="w-3.5 h-3.5" />
                              </div>
                              {selectedInquiry.email}
                            </button>
                            {selectedInquiry.phone && (
                              <a
                                href={`tel:${selectedInquiry.phone}`}
                                className="flex items-center gap-2 text-slate-600 hover:text-daw-green font-medium transition-colors group/phone"
                              >
                                <div className="p-1.5 bg-slate-100 rounded-md group-hover/phone:bg-daw-green/10 transition-colors">
                                  <Phone className="w-3.5 h-3.5" />
                                </div>
                                {selectedInquiry.phone}
                              </a>
                            )}
                            {selectedInquiry.company && (
                              <div className="flex items-center gap-2 text-slate-600 font-medium">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                                  <Building className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-slate-900">
                                  {selectedInquiry.company}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 md:px-8 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <MailOpen className="w-4 h-4 text-daw-green" />{" "}
                          Message Content
                        </h3>
                      </div>
                      <div className="p-6 md:p-8 text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-[15px]">
                        {selectedInquiry.message}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-daw-green rounded-full blur-[80px]"></div>
                      </div>
                      <div className="relative z-10 text-center md:text-left">
                        <h4 className="text-white font-bold text-lg mb-1">
                          Ready to reply?
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Choose your preferred email client below.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center md:justify-end items-center gap-3 relative z-10 w-full md:w-auto">
                        <button
                          onClick={() => openWebMail("gmail")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-5 py-2.5 rounded-xl font-medium transition-all  group"
                        >
                          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Mail className="w-3.5 h-3.5 text-white" />
                          </div>{" "}
                          Gmail
                        </button>
                        <button
                          onClick={() => openWebMail("outlook")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-5 py-2.5 rounded-xl font-medium transition-all  group"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Mail className="w-3.5 h-3.5 text-white" />
                          </div>{" "}
                          Outlook
                        </button>
                        <button
                          onClick={() =>
                            copyEmailToClipboard(selectedInquiry.email)
                          }
                          className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-daw-green hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                        >
                          Copy Email
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  No Message Selected
                </h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Select a message from the list on the left to read its
                  contents.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL MASTER SUBJECT */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/80"
            onClick={() => setIsSubjectModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-serif font-bold text-xl text-slate-900">
                Manage Inquiry Subjects
              </h2>
              <button
                onClick={() => {
                  setIsSubjectModalOpen(false);
                  setEditingSubjectId(null);
                  setNewSubject({ name: "", isActive: true });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Form Add/Edit */}
              <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex-1 space-y-1 w-full">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Subject Name
                  </label>
                  <input
                    value={newSubject.name} // Diubah dari nameEn menjadi name
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
                    placeholder="e.g. Careers & Internships"
                  />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <label className="flex items-center gap-2 cursor-pointer h-10">
                    <input
                      type="checkbox"
                      checked={newSubject.isActive}
                      onChange={(e) =>
                        setNewSubject({
                          ...newSubject,
                          isActive: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-daw-green rounded border-slate-300 focus:ring-daw-green"
                    />
                    <span className="text-xs font-bold text-slate-600">
                      Active
                    </span>
                  </label>
                  <button
                    onClick={async () => {
                      if (!newSubject.name)
                        return toast.error("Subject name cannot be empty");
                      try {
                        if (editingSubjectId) {
                          await api.put(
                            `/inquiries/subjects/${editingSubjectId}`,
                            newSubject,
                          );
                          toast.success("Subject updated");
                        } else {
                          await api.post("/inquiries/subjects", newSubject);
                          toast.success("Subject added");
                        }
                        setNewSubject({ name: "", isActive: true });
                        setEditingSubjectId(null);
                        fetchSubjects();
                      } catch (error) {
                        toast.error("Failed to save subject");
                      }
                    }}
                    className="bg-daw-green text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shrink-0 h-10"
                  >
                    {editingSubjectId ? "Update" : "Add"}
                  </button>
                </div>
              </div>

              {/* Table List */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 custom-scrollbar">
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
                          className="text-center py-6 text-slate-500 text-xs bg-white"
                        >
                          No subjects found. Add one above.
                        </td>
                      </tr>
                    ) : (
                      subjects.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 transition-colors bg-white"
                        >
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                            >
                              {s.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-3">
                            <button
                              onClick={() => {
                                setNewSubject({
                                  name: s.name,
                                  isActive: s.isActive,
                                });
                                setEditingSubjectId(s.id);
                              }}
                              className="text-daw-green font-medium hover:underline text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    "Are you sure you want to delete this subject?",
                                  )
                                ) {
                                  try {
                                    await api.delete(
                                      `/inquiries/subjects/${s.id}`,
                                    );
                                    fetchSubjects();
                                    toast.success("Subject deleted");
                                  } catch (error) {
                                    toast.error("Delete failed");
                                  }
                                }
                              }}
                              className="text-red-500 font-medium hover:underline text-xs"
                            >
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
      )}
    </>
  );
}
