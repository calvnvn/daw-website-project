import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileEdit,
  Eye,
  CheckCircle2,
  Plus,
  Users,
  Activity,
  FileCheck2,
  Hourglass,
  Flame,
  Settings,
  Newspaper,
  Award,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Inquiry {
  id: string;
  name: string;
  company?: string;
  subject?: string;
  message: string;
  createdAt: string;
}

interface ApprovalDraft {
  id: string;
  notrans: string;
  module_name: string;
  action: string;
  status: string;
  createdAt: string;
  reason_rejection?: string;
}

interface NewsArticleBasic {
  id: string;
  title: string;
  views: number;
  slug: string;
}

interface DashboardData {
  stats?: {
    unreadInquiries: number;
    draftProjects: number;
    totalViews: number;
  };
  recentInquiries?: Inquiry[];
  pendingApprovals?: ApprovalDraft[];
  myDrafts?: ApprovalDraft[];
  activeStaging?: ApprovalDraft[];
  topNews?: NewsArticleBasic[];
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const { user, can } = useAuth();
  const firstName = user?.name ? user.name.split(" ")[0] : "Administrator";
  const role = user?.role?.toLowerCase() || "editor";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/dashboard/stats");
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error("Dashboard Data Sync Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-daw-green" />
        <p className="text-sm font-medium animate-pulse">
          Memuat Command Center...
        </p>
      </div>
    );
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <span className="px-2 py-1 text-[10px] font-bold bg-amber-100 text-amber-600 rounded-md uppercase tracking-wider flex items-center gap-1">
            <Hourglass className="w-3 h-3" /> Pending
          </span>
        );
      case "Approved":
        return (
          <span className="px-2 py-1 text-[10px] font-bold bg-daw-green/10 text-daw-green rounded-md uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-600 rounded-md uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  const renderDraftList = (
    drafts: ApprovalDraft[],
    emptyMessage: string,
    readOnly = false,
  ) => {
    if (!drafts || drafts.length === 0) {
      return (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center border-t border-slate-100">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-slate-800">
                  {draft.notrans}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {draft.module_name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Action:{" "}
                <span className="font-bold text-slate-700">{draft.action}</span>{" "}
                • {formatDate(draft.createdAt)}
              </p>
              {draft.status === "Rejected" && draft.reason_rejection && (
                <p className="text-[11px] mt-1 text-red-500 font-medium">
                  Reason: {draft.reason_rejection}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {renderStatusBadge(draft.status)}
              {!readOnly && role === "approver" && (
                <Link
                  to={`/admin/approvals?ticket=${draft.notrans}`}
                  className="text-[10px] font-bold text-daw-green hover:underline">
                  Review &rarr;
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const UserProfileCard = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-daw-green/5 to-transparent rounded-bl-full pointer-events-none"></div>
      <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0 shadow-inner z-10">
        <ShieldCheck className="w-7 h-7 text-daw-green" />
      </div>
      <div className="flex-1 min-w-0 z-10">
        <h3 className="text-base font-bold text-slate-900 truncate">
          {user?.name || "Administrator"}
        </h3>
        <p className="text-[10px] font-bold text-daw-green uppercase tracking-widest mt-0.5">
          {user?.role || "superadmin"}
        </p>
        <p className="text-xs text-slate-500 truncate mt-1">
          {user?.email || "admin@daw.com"}
        </p>
      </div>
    </div>
  );

  const TopNewsWidget = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <Flame className="w-4 h-4 text-orange-500" /> Top Berita
        </h3>
      </div>
      <div className="divide-y divide-slate-100 flex-1">
        {dashboardData?.topNews?.map((news, idx) => (
          <Link
            key={news.id}
            to={`/admin/news/edit/${news.id}`}
            className="p-4 flex items-center gap-3 hover:bg-orange-50/30 transition-colors group">
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${idx === 0 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
              #{idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-orange-600 transition-colors">
                {news.title}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Eye className="w-3 h-3" /> {news.views}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  const MetricsRow = () => {
    const stats = dashboardData?.stats || {
      unreadInquiries: 0,
      draftProjects: 0,
      totalViews: 0,
    };
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/inbox"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between hover:border-amber-300 relative overflow-hidden">
          {stats.unreadInquiries > 0 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
          )}
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3 rounded-xl transition-colors ${stats.unreadInquiries > 0 ? "bg-amber-100 text-amber-600 shadow-inner" : "bg-slate-100 text-slate-400"}`}>
              <Mail className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3
              className={`text-4xl font-black mb-1 tracking-tight ${stats.unreadInquiries > 0 ? "text-amber-600" : "text-slate-900"}`}>
              {stats.unreadInquiries}
            </h3>
            <p className="text-sm font-semibold text-slate-700">Pesan Baru</p>
            <p className="text-xs text-slate-400 mt-1">Menunggu tanggapan</p>
          </div>
        </Link>
        <Link
          to="/admin/projects"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between hover:border-blue-300 relative overflow-hidden">
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-tl from-blue-500/5 to-transparent rounded-full pointer-events-none"></div>
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3 rounded-xl transition-colors ${stats.draftProjects > 0 ? "bg-blue-100 text-blue-600 shadow-inner" : "bg-slate-100 text-slate-400"}`}>
              <FileEdit className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3
              className={`text-4xl font-black mb-1 tracking-tight ${stats.draftProjects > 0 ? "text-blue-600" : "text-slate-900"}`}>
              {stats.draftProjects}
            </h3>
            <p className="text-sm font-semibold text-slate-700">Draf Proyek</p>
            <p className="text-xs text-slate-400 mt-1">Konten belum rilis</p>
          </div>
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-daw-green/10 via-transparent to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-start justify-between mb-4 z-10">
            <div className="p-3 bg-daw-green/10 text-daw-green rounded-xl shadow-inner">
              <Activity className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div className="z-10">
            <h3 className="text-4xl font-black text-daw-green mb-1 tracking-tight">
              {stats.totalViews.toLocaleString("id-ID")}
            </h3>
            <p className="text-sm font-semibold text-slate-700">
              Kunjungan Global
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total impresi portofolio & berita
            </p>
          </div>
        </div>
      </div>
    );
  };

  const InboxWidget = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <Mail className="w-4 h-4 text-amber-500" /> Pesan Terbaru
        </h3>
        <Link
          to="/admin/inbox"
          className="text-[10px] font-bold text-daw-green hover:underline flex items-center gap-1 uppercase tracking-widest">
          Lihat Semua <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-slate-100 overflow-y-auto">
        {dashboardData?.recentInquiries?.length ? (
          dashboardData.recentInquiries.map((inq) => (
            <div
              key={inq.id}
              className="p-5 hover:bg-amber-50/30 transition-colors flex gap-4 items-start group">
              <div className="mt-1 w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {inq.name}{" "}
                    {inq.company && (
                      <span className="font-normal text-slate-500 ml-1">
                        - {inq.company}
                      </span>
                    )}
                  </p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 pl-2">
                    {formatDate(inq.createdAt)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 mb-1 truncate">
                  {inq.subject || "General Inquiry"}
                </p>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {inq.message}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Kotak Masuk Bersih
            </h3>
            <p className="text-xs text-slate-500">Tidak ada pesan baru.</p>
          </div>
        )}
      </div>
    </div>
  );

  // --- VIEWPORT RENDERS ---

  // 1. APPROVER VIEW
  if (role === "approver") {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard Peninjauan Konten
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tinjau dan proses pengajuan konten yang akan tayang.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <FileCheck2 className="w-4 h-4 text-blue-500" /> Pending
                Approval Queue
              </h3>
            </div>
            {renderDraftList(
              dashboardData?.pendingApprovals || [],
              "No pending approvals. Queue is clear.",
            )}
          </div>
          <div className="space-y-6">
            <UserProfileCard />
            <Link
              to="/admin/approvals"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-daw-green hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-2 rounded-lg text-daw-green">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-700">
                  Go to Approval Center
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-daw-green transform group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. EDITOR VIEW
  if (role === "editor") {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Pusat Konten
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Selamat datang kembali, {firstName}. Kelola konten dan lacak
              pengajuan Anda.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-500">{today}</p>
          </div>
        </div>

        <MetricsRow />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <InboxWidget />
          </div>
          <div className="space-y-6">
            <UserProfileCard />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[300px]">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                  <Hourglass className="w-4 h-4 text-purple-500" /> My Draft
                  History
                </h3>
              </div>
              {renderDraftList(
                dashboardData?.myDrafts || [],
                "You have no staging submissions yet.",
                true,
              )}
            </div>

            <TopNewsWidget />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
                Akses Cepat
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/admin/news/create"
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-daw-green hover:bg-green-50 transition-colors text-center group">
                  <Newspaper className="w-5 h-5 text-slate-400 group-hover:text-daw-green mb-1 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-daw-green">
                    Tulis Berita
                  </span>
                </Link>
                <Link
                  to="/admin/projects/create"
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center group">
                  <Plus className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-1 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-blue-600">
                    Buat Proyek
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. ADMIN / SUPERADMIN VIEW
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Pusat Konten
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Selamat datang kembali, {firstName}. Kelola konten dan lacak
            pengajuan Anda.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-500">{today}</p>
        </div>
      </div>

      <MetricsRow />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <InboxWidget />

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-blue-500" /> Pantau
                Peninjauan Aktif
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase font-bold">
                Hanya Baca
              </span>
            </div>
            {renderDraftList(
              dashboardData?.activeStaging || [],
              "Tidak ada alur peninjauan aktif saat ini.",
              true,
            )}
          </div>
        </div>

        <div className="space-y-6">
          <UserProfileCard />
          <TopNewsWidget />

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
              System Management
            </h3>
            <div className="space-y-3">
              {can("manage_users") && (
                <Link
                  to="/admin/users"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="bg-white shadow-sm p-1.5 rounded-lg text-blue-600">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      Kelola Pengguna
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              {can("manage_settings") && (
                <Link
                  to="/admin/settings"
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-daw-green hover:bg-green-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="bg-white shadow-sm p-1.5 rounded-lg text-daw-green">
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      Global Settings
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-daw-green transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
