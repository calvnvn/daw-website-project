import { useState } from "react";
import {
  Search,
  Mail,
  MailOpen,
  Trash2,
  CheckCircle2,
  Clock,
  Phone,
  Building,
} from "lucide-react";

interface Inquiry {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  date: string;
  isRead: boolean;
  company?: string;
}

const mockInquiries: Inquiry[] = [
  {
    id: 1,
    name: "Budi Santoso",
    email: "budi.santoso@vendor-energi.com",
    phone: "+62 812 3456 7890",
    company: "PT Maju Energi",
    message:
      "Halo tim DAW, kami tertarik untuk mendiskusikan potensi kerjasama suplai komponen untuk PLTA Kualu. Apakah memungkinkan untuk mengatur jadwal meeting minggu depan?",
    date: "Today, 09:30 AM",
    isRead: false,
  },
  {
    id: 2,
    name: "Sarah Jenkins",
    email: "s.jenkins@global-invest.org",
    phone: "+65 9123 4567",
    company: "Global Green Investments",
    message:
      "Dear DAW Management, we are currently looking into renewable energy portfolios in Southeast Asia. We would like to request more information regarding your ESG compliance and carbon offset programs.",
    date: "Yesterday, 14:15 PM",
    isRead: false,
  },
  {
    id: 3,
    name: "Ahmad Riyadi",
    email: "ahmad.r@gmail.com",
    phone: "+62 856 7890 1234",
    message:
      "Selamat siang, saya mahasiswa tingkat akhir yang sedang melakukan riset tentang pengolahan limbah kelapa sawit (PKS). Apakah PT DAW menerima kunjungan industri untuk mahasiswa?",
    date: "Mar 07, 2026",
    isRead: true,
  },
];

export default function Inbox() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(mockInquiries);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(
    mockInquiries[0].id,
  );

  // Search Filter Logic
  const filteredInquiries = inquiries.filter(
    (inq) =>
      inq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inq.message.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedInquiry = inquiries.find((inq) => inq.id === selectedInquiryId);

  const unreadCount = inquiries.filter((inq) => !inq.isRead).length;

  // Mark as Read
  const markAsRead = (id: number) => {
    setInquiries(
      inquiries.map((inq) => (inq.id === id ? { ...inq, isRead: true } : inq)),
    );
  };

  // Delete Message
  const deleteInquiry = (id: number) => {
    if (confirm("Are you sure you want to delete this message?")) {
      const newInquiries = inquiries.filter((inq) => inq.id !== id);
      setInquiries(newInquiries);
      if (selectedInquiryId === id) {
        setSelectedInquiryId(
          newInquiries.length > 0 ? newInquiries[0].id : null,
        );
      }
    }
  };

  // Handler when Clicked
  const handleSelectInquiry = (id: number) => {
    setSelectedInquiryId(id);
    markAsRead(id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
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
          <Mail className="w-4 h-4" />
          {unreadCount} Unread Messages
        </div>
      </div>

      {/* --- SPLIT PANE LAYOUT --- */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-full min-h-[500px]">
        {/* LEFT COLUMN: Message List */}
        <div className="w-full md:w-[350px] lg:w-[400px] border-r border-slate-200 flex flex-col shrink-0">
          {/* Search Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
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
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredInquiries.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredInquiries.map((inq) => (
                  <button
                    key={inq.id}
                    onClick={() => handleSelectInquiry(inq.id)}
                    className={`w-full text-left p-4 transition-colors hover:bg-slate-50 relative ${
                      selectedInquiryId === inq.id ? "bg-green-50/50" : ""
                    }`}
                  >
                    {/* Active Indicator Line */}
                    {selectedInquiryId === inq.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-daw-green" />
                    )}

                    <div className="flex justify-between items-start mb-1">
                      <h3
                        className={`text-sm truncate pr-4 ${!inq.isRead ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}
                      >
                        {inq.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {inq.date}
                      </span>
                    </div>

                    <h4
                      className={`text-xs truncate mb-1 ${!inq.isRead ? "font-semibold text-slate-800" : "text-slate-500"}`}
                    >
                      {inq.company || "Individual / No Company"}
                    </h4>

                    <p
                      className={`text-xs line-clamp-2 ${!inq.isRead ? "text-slate-600 font-medium" : "text-slate-400"}`}
                    >
                      {inq.message}
                    </p>

                    {/* Unread Dot */}
                    {!inq.isRead && (
                      <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-daw-green rounded-full shadow-sm" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No messages found.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Message Detail */}
        <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden">
          {selectedInquiry ? (
            <>
              {/* Detail Action Bar */}
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

              {/* Detail Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="max-w-3xl">
                  {/* Sender Info Card */}
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
                        <a
                          href={`tel:${selectedInquiry.phone}`}
                          className="flex items-center gap-1.5 hover:text-daw-green transition-colors"
                        >
                          <Phone className="w-4 h-4" /> {selectedInquiry.phone}
                        </a>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-end gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Received
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedInquiry.date}
                      </p>
                    </div>
                  </div>

                  {/* Company Info */}
                  {selectedInquiry.company && (
                    <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                      <Building className="w-4 h-4" />
                      Organization: {selectedInquiry.company}
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                      Message Content
                    </h3>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedInquiry.message}
                    </p>
                  </div>

                  {/* Reply Action */}
                  <div className="mt-8">
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=Reply from PT Dharma Agung Wijaya`}
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      Reply via Email Client
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Empty State
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
