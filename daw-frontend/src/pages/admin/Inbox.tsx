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

  // FETCH DATA DARI DATABASE
  useEffect(() => {
    const fetchInquiries = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("daw_token");
        const res = await fetch("http://localhost:5000/api/inquiries", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setInquiries(data);
        if (data.length > 0 && !selectedInquiryId) {
          setSelectedInquiryId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch inquiries", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInquiries();
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
      // Centang semua pesan yang SEDANG TAMPIL (difilter)
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

  const bulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedMails.length} messages?`,
      )
    )
      return;

    try {
      const token = localStorage.getItem("daw_token");
      for (const id of selectedMails) {
        await fetch(`http://localhost:5000/api/inquiries/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setInquiries((prev) =>
        prev.filter((inq) => !selectedMails.includes(inq.id)),
      );
      setSelectedMails([]); // Reset centangan
      setSelectedInquiryId(null);
    } catch (err) {
      console.error("Bulk delete error", err);
    }
  };

  const selectedInquiry = inquiries.find((inq) => inq.id === selectedInquiryId);
  const unreadCount = inquiries.filter((inq) => !inq.isRead).length;

  const markAsRead = async (id: number) => {
    try {
      const token = localStorage.getItem("daw_token");
      await fetch(`http://localhost:5000/api/inquiries/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setInquiries(
        inquiries.map((inq) =>
          inq.id === id ? { ...inq, isRead: true } : inq,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const deleteInquiry = async (id: number) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const token = localStorage.getItem("daw_token");
      await fetch(`http://localhost:5000/api/inquiries/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const newInquiries = inquiries.filter((inq) => inq.id !== id);
      setInquiries(newInquiries);
      if (selectedInquiryId === id)
        setSelectedInquiryId(
          newInquiries.length > 0 ? newInquiries[0].id : null,
        );
    } catch (error) {
      console.error(error);
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
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Contact Inquiries
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage messages received from the public Contact Us form.
          </p>
        </div>
        <div className="bg-daw-green/10 text-daw-green px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
          <Mail className="w-4 h-4" /> {unreadCount} Unread Messages
        </div>
      </div>

      {/* SPLIT PANE LAYOUT */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px] h-[calc(100vh-200px)] max-h-[700px]">
        {/* LEFT: LIST */}
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
              {[
                "All",
                "General Inquiry",
                "Business Partnership",
                "Investment & ESG",
                "Careers",
                "Media & PR",
              ].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setFilterSubject(sub)}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold whitespace-nowrap transition-colors ${filterSubject === sub ? "bg-daw-green text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* BULK ACTION PANEL (Muncul jika ada yang dicentang) */}
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

          {/* LIST & SKELETON AREA */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* 1. LOADING STATE (Skeleton) */}
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
              /* 2. DATA LOADED STATE */
              <div className="divide-y divide-slate-100">
                {filteredInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className={`flex items-start p-4 transition-colors hover:bg-slate-50 group relative cursor-pointer ${selectedInquiryId === inq.id ? "bg-green-50/50" : ""}`}
                    onClick={() => handleSelectInquiry(inq.id)}
                  >
                    {/* Active Line Indicator */}
                    {selectedInquiryId === inq.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-daw-green" />
                    )}

                    {/* Checkbox (Bulk Action) */}
                    <div
                      className="shrink-0 mr-3 mt-0.5"
                      onClick={
                        (e) =>
                          e.stopPropagation() /* Jangan trigger select saat klik checkbox */
                      }
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

                    {/* Unread Dot */}
                    {!inq.isRead && (
                      <div className="shrink-0 w-2 h-2 bg-daw-green rounded-full ml-3 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* 3. EMPTY STATE (Jika Kosong) */
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

              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="max-w-3xl">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-6 items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 mb-1">
                        {selectedInquiry.name}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <a
                          href={`mailto:${selectedInquiry.email}`}
                          className="flex items-center gap-1.5 hover:text-daw-green transition-colors"
                        >
                          <Mail className="w-4 h-4" /> {selectedInquiry.email}
                        </a>
                        {selectedInquiry.phone && (
                          <a
                            href={`tel:${selectedInquiry.phone}`}
                            className="flex items-center gap-1.5 hover:text-daw-green transition-colors"
                          >
                            <Phone className="w-4 h-4" />{" "}
                            {selectedInquiry.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Received
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(selectedInquiry.createdAt)}
                      </p>
                    </div>
                  </div>

                  {selectedInquiry.company && (
                    <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                      <Building className="w-4 h-4" /> Organization:{" "}
                      {selectedInquiry.company}
                    </div>
                  )}

                  <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                      Message Content
                    </h3>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedInquiry.message}
                    </p>
                  </div>

                  <div className="mt-8">
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=Reply from PT Dharma Agung Wijaya`}
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
                    >
                      <Mail className="w-4 h-4" /> Reply via Email Client
                    </a>
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
                Select a message from the list on the left to read its contents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
