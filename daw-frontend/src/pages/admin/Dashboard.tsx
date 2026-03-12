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
} from "lucide-react";

interface DashboardData {
  stats: {
    unreadInquiries: number;
    draftProjects: number;
    totalViews: number;
  };
  recentInquiries: any[];
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Mengambil data user dari localStorage
  const user = JSON.parse(localStorage.getItem("daw_user") || "{}");
  const firstName = user.name ? user.name.split(" ")[0] : "Admin";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("daw_token");
      const response = await fetch(
        "http://localhost:5000/api/dashboard/stats",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = await response.json();
      if (response.ok) {
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
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
          Syncing Mission Control...
        </p>
      </div>
    );
  }

  const { stats, recentInquiries } = dashboardData || {
    stats: { unreadInquiries: 0, draftProjects: 0, totalViews: 0 },
    recentInquiries: [],
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* --- 1. HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here is your operational overview for PT Dharma Agung Wijaya.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-500">{today}</p>
        </div>
      </div>

      {/* --- 2. TOP METRICS (The "To-Do" Bar) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Unread Inquiries Card (Amber/Orange) */}
        <Link
          to="/admin/inbox"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between hover:border-amber-300 relative overflow-hidden"
        >
          {stats.unreadInquiries > 0 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none"></div>
          )}
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3 rounded-lg transition-colors ${stats.unreadInquiries > 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}
            >
              <Mail className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3
              className={`text-4xl font-bold mb-1 tracking-tight ${stats.unreadInquiries > 0 ? "text-amber-600" : "text-slate-900"}`}
            >
              {stats.unreadInquiries}
            </h3>
            <p className="text-sm font-semibold text-slate-700">
              Unread Messages
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Awaiting your response
            </p>
          </div>
        </Link>

        {/* Draft Projects Card (Blue) */}
        <Link
          to="/admin/projects"
          className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between hover:border-blue-300 relative overflow-hidden"
        >
          <div className="flex items-start justify-between mb-4">
            <div
              className={`p-3 rounded-lg transition-colors ${stats.draftProjects > 0 ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}
            >
              <FileEdit className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3
              className={`text-4xl font-bold mb-1 tracking-tight ${stats.draftProjects > 0 ? "text-blue-600" : "text-slate-900"}`}
            >
              {stats.draftProjects}
            </h3>
            <p className="text-sm font-semibold text-slate-700">
              Pending Drafts
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Content not yet published
            </p>
          </div>
        </Link>

        {/* Total Views Card (DAW Green) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-daw-green/5 rounded-full pointer-events-none"></div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-daw-green/10 text-daw-green rounded-lg">
              <Eye className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h3 className="text-4xl font-bold text-daw-green mb-1 tracking-tight">
              {stats.totalViews.toLocaleString("id-ID")}
            </h3>
            <p className="text-sm font-semibold text-slate-700">
              Portfolio Views
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total public impressions
            </p>
          </div>
        </div>
      </div>

      {/* --- 3. MAIN CONTENT (Split Layout) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KOLOM KIRI (2/3): Needs Attention (Inquiries) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
              <Mail className="w-4 h-4 text-amber-500" /> Needs Attention
            </h3>
            <Link
              to="/admin/inbox"
              className="text-xs font-bold text-daw-green hover:underline flex items-center gap-1"
            >
              Go to Inbox <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 flex flex-col divide-y divide-slate-100">
            {recentInquiries.length > 0 ? (
              recentInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="p-5 hover:bg-amber-50/30 transition-colors flex gap-4 items-start group"
                >
                  <div className="mt-1 w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {inq.name}
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
                  Inbox is Clear!
                </h3>
                <p className="text-xs text-slate-500">
                  You have no unread messages to respond to.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* KOLOM KANAN (1/3): Profile & Quick Commands */}
        <div className="space-y-6">
          {/* Compact Profile Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-daw-green" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {user.name || "Administrator"}
              </h3>
              <p className="text-[10px] font-bold text-daw-green uppercase tracking-widest mt-0.5">
                {user.role || "Superadmin"}
              </p>
              <p className="text-xs text-slate-500 truncate mt-1">
                {user.email || "admin@daw.com"}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">
              Quick Commands
            </h3>
            <div className="space-y-3">
              <Link
                to="/admin/projects/create"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-daw-green hover:bg-green-50 group transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-md shadow-sm text-daw-green">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-daw-green transition-colors">
                    Write New Project
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-daw-green transition-all transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-300 hover:bg-blue-50 group transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1.5 rounded-md shadow-sm text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                    Manage Users
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-all transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
