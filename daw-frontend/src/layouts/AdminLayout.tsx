import { useState, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderTree,
  Inbox,
  Settings,
  LogOut,
  Menu,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  MonitorPlay,
  Shield,
  Briefcase,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  Building2,
  FileText,
  ClipboardCheck,
  ArrowRight,
  Newspaper,
} from "lucide-react";
import api from "@/lib/api";
import logoDaw from "@/assets/logo-daw.png";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface InquiryData {
  id: string | number;
  name: string;
  subject: string;
  message: string;
  isRead: boolean;
  [key: string]: unknown;
}

/**
 * MENU CONFIGURATION (DOMAIN-DRIVEN)
 * @description Groups navigation items into logical business domains.
 * Headers will automatically hide if a user lacks permissions for all items in a group.
 */
const MENU_GROUPS = [
  {
    label: "Main Desk",
    items: [
      { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
      {
        name: "Approval Queue",
        path: "/admin/approvals",
        icon: ClipboardCheck,
        perm: "manage_approvals",
      },
      {
        name: "Inbox",
        path: "/admin/inbox",
        icon: Inbox,
        perm: "manage_inbox",
      },
    ],
  },
  {
    label: "Corporate",
    items: [
      {
        name: "Businesses",
        path: "/admin/businesses",
        icon: Building2,
        perm: "manage_businesses",
      },
      {
        name: "Projects",
        path: "/admin/projects",
        icon: FolderTree,
        perm: "manage_projects",
      },
      {
        name: "Investments",
        path: "/admin/investments",
        icon: Briefcase,
        perm: "manage_investments",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        name: "Content Manager",
        path: "/admin/content",
        icon: FileText,
        perm: "manage_content",
      },
      {
        name: "Homepage",
        path: "/admin/home",
        icon: MonitorPlay,
        perm: "manage_homepage",
      },
      {
        name: "About Us",
        path: "/admin/about",
        icon: Users,
        perm: "manage_about",
      },
      {
        name: "News & Events",
        path: "/admin/news",
        icon: Newspaper,
        perm: "manage_news",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        name: "User Access",
        path: "/admin/users",
        icon: Shield,
        perm: "manage_users",
      },
      {
        name: "Settings",
        path: "/admin/settings",
        icon: Settings,
        perm: "manage_settings",
      },
    ],
  },
];

export default function AdminLayout() {
  const { settings } = useSettings();

  const { can, user, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [unreadInquiries, setUnreadInquiries] = useState<InquiryData[]>([]);
  const [unreadApprovals, setUnreadApprovals] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const breadcrumbLabels: Record<string, string> = {
    admin: "Dashboard",
    approvals: "Approval Center",
    projects: "Project List",
    users: "User Management",
    roles: "Access Control",
    settings: "Global Settings",
    home: "Homepage Editor",
    news: "News & Events",
    create: "New Data",
    edit: "Modify",
  };

  const isParamId = (path: string) => path.length > 20 || !isNaN(Number(path));

  useEffect(() => {
    setIsNotifOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]); // Hanya bergantung pada rute

  // 2. LOGIKA POLLING: Hanya dijalankan sekali saat komponen di-mount
  useEffect(() => {
    // Pastikan user sudah login sebelum memanggil API
    if (!user) return;

    const fetchNotifications = async () => {
      // Gunakan try-catch per-block agar jika salah satu gagal, yang lain tetap jalan
      if (can("manage_inbox")) {
        try {
          const response = await api.get("/inquiries");
          const payload = response.data?.data || response.data;
          if (Array.isArray(payload)) {
            const unread = payload.filter(
              (item: InquiryData) => !item.isRead,
            );
            setUnreadInquiries(unread);
          }
        } catch (error) {
          console.error("Failed to fetch inbox notifications:", error);
        }
      }

      if (can("manage_approvals")) {
        try {
          const response = await api.get("/approval/list");
          const rows = response.data?.data?.rows || [];
          setUnreadApprovals(rows);
        } catch (error) {
          console.error("Failed to fetch approval notifications:", error);
        }
      }
    };

    // Panggil langsung saat komponen pertama kali dimuat
    fetchNotifications();

    // Set interval setiap 2 menit, tidak peduli user pindah halaman atau tidak
    const interval = setInterval(fetchNotifications, 1000 * 60 * 2);

    return () => clearInterval(interval);
  }, [user, can]); // Hanya bergantung pada identitas user dan permission

  const executeLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
  };

  /**
   * FILTERED MENU LOGIC
   * @concept: "superadmin Bypass"
   * If the user role is 'admin' (from OWL), they get access to everything.
   * Otherwise, we strictly check their specific permissions.
   */
  const filteredMenuGroups = useMemo(() => {
    return MENU_GROUPS.map((group) => {
      return {
        ...group,
        items: group.items.filter((item) => {
          if (!item.perm) return true;

          const isMasterAdmin =
            user?.role === "admin" || user?.role === "superadmin";
          if (isMasterAdmin) return true;

          return can(item.perm);
        }),
      };
    }).filter((group) => group.items.length > 0);
  }, [user, can]);

  return (
    <div className="h-[100dvh] bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* --- 1. OVERLAY UNTUK MOBILE --- */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      {/* --- 2. SIDEBAR  --- */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col h-full
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 ${isDesktopCollapsed ? "md:w-[84px]" : "md:w-[260px]"}
      `}>
        {/* AREA LOGO (Warna Asli) */}
        <div className="h-20 flex items-center px-8 border-b border-slate-100">
          <img
            src={
              settings?.logoUrl ? getCleanImageUrl(settings.logoUrl) : logoDaw
            }
            alt="DAW Admin Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* NAVIGATION MENU */}
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto custom-scrollbar px-3">
          {filteredMenuGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? "mt-4" : ""}>
              {/* GROUP HEADER */}
              <p
                className={`text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-2 px-3 transition-all duration-300 ${
                  isDesktopCollapsed
                    ? "h-0 overflow-hidden opacity-0 m-0 p-0"
                    : "opacity-100"
                }`}>
                {group.label}
              </p>

              {/* GROUP ITEMS */}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  // Dynamic badge assignment
                  const dynamicBadge =
                    item.name === "Inbox" && unreadInquiries.length > 0
                      ? unreadInquiries.length
                      : item.name === "Approval Queue" &&
                          unreadApprovals.length > 0
                        ? unreadApprovals.length
                        : undefined;

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`
                        relative flex items-center px-3 py-3 rounded-xl transition-all duration-200 group
                        ${isActive ? "bg-daw-green/10 text-daw-green font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-daw-green"}
                        ${isDesktopCollapsed ? "justify-center" : "justify-between"}
                      `}>
                      {/* Active Left Border Accent */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-daw-green rounded-r-full" />
                      )}

                      <div className="flex items-center">
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive
                              ? "text-daw-green"
                              : "text-slate-400 group-hover:text-daw-green"
                          }`}
                        />
                        <span
                          className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                            isDesktopCollapsed
                              ? "md:w-0 md:opacity-0 ml-0"
                              : "w-auto opacity-100 ml-3"
                          }`}>
                          {item.name}
                        </span>
                      </div>

                      {/* Notification Badge */}
                      {dynamicBadge && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          {dynamicBadge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* AREA PROFIL & LOGOUT */}
        <div
          className={`p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-4 ${isDesktopCollapsed ? "items-center" : ""}`}>
          <div
            className={`flex items-center gap-3 ${isDesktopCollapsed ? "justify-center" : "px-2"}`}>
            <div className="w-10 h-10 shrink-0 rounded-full bg-daw-green text-white flex items-center justify-center font-bold shadow-sm uppercase">
              {user?.name ? user.name.charAt(0) : "U"}
            </div>
            {/* Detail Profil Menghilang saat Collapsed */}
            <div
              className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}>
              <p className="text-sm font-bold text-slate-800 truncate">
                {user?.name || "Loading..."}
              </p>
              <p className="text-[11px] text-slate-500 truncate uppercase tracking-wider">
                {user?.role || "Synchronizing..."}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsLogoutModalOpen(true)}
            title={isDesktopCollapsed ? "Sign Out" : ""}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors shadow-sm ${isDesktopCollapsed ? "w-10 px-0" : "w-full"}`}>
            <LogOut className="w-4 h-4 shrink-0" />
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>
      {/* --- 3. MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* TOP HEADER */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <button
              className="hidden md:block p-2 -ml-2 text-slate-500 hover:text-daw-green hover:bg-slate-50 rounded-lg transition-colors"
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}>
              {isDesktopCollapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>

            {/* ---> 1. DYNAMIC BREADCRUMBS <--- */}
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
              {location.pathname
                .split("/")
                .filter((x) => x && !isParamId(x))
                .map((path, index, array) => {
                  const isLast = index === array.length - 1;
                  const label =
                    breadcrumbLabels[path] || path.replace(/-/g, " ");

                  return (
                    <div key={path} className="flex items-center gap-2">
                      <span
                        className={`capitalize ${isLast ? "text-slate-900 font-bold" : "text-slate-400"}`}>
                        {label}
                      </span>
                      {!isLast && (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* ---> 2. NOTIFICATION BELL & DROPDOWN <--- */}
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`p-2 rounded-full transition-colors relative ${isNotifOpen ? "bg-daw-green/10 text-daw-green" : "text-slate-400 hover:text-daw-green hover:bg-slate-50"}`}>
              <Bell className="w-5 h-5" />
              {(unreadInquiries.length > 0 || unreadApprovals.length > 0) && (
                <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
              )}
            </button>

            {/* Panel Dropdown Notifikasi */}
            {isNotifOpen && (
              <div className="absolute top-full right-0 mt-4 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-900">Notifications</h3>
                  {unreadInquiries.length > 0 && (
                    <span className="bg-daw-green/10 text-daw-green text-xs font-bold px-2 py-1 rounded-md">
                      {unreadInquiries.length} New
                    </span>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                  {unreadApprovals.length > 0 && (
                    <div className="p-3 bg-blue-50/50 border-b border-blue-100">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">
                        Pending Approvals
                      </p>
                      <div
                        onClick={() => {
                          navigate("/admin/approvals");
                          setIsNotifOpen(false);
                        }}
                        className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-100 shadow-sm cursor-pointer hover:bg-blue-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500 text-white rounded-lg">
                            <ClipboardCheck className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-slate-700">
                            {unreadApprovals.length} Draf revisi masuk
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-300" />
                      </div>
                    </div>
                  )}
                  {unreadInquiries.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                      {unreadInquiries.slice(0, 5).map((inq) => (
                        <div
                          key={inq.id}
                          className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setIsNotifOpen(false);
                            if (can("manage_inbox")) {
                              navigate("/admin/inbox");
                            }
                          }}>
                          <div className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-100">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {inq.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {inq.subject}
                              </p>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                {inq.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Bell className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">
                        All Caught Up!
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        You have no new notifications.
                      </p>
                    </div>
                  )}
                </div>

                {unreadInquiries.length > 0 && can("manage_inbox") && (
                  <div className="p-3 border-t border-slate-100 bg-white">
                    <button
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate("/admin/inbox");
                      }}
                      className="w-full py-2 text-sm font-bold text-daw-green hover:bg-daw-green/10 rounded-lg transition-colors">
                      View All Messages
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        {/* DYNAMIC CONTENT (Area Utama) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-900">
                Sign Out Confirmation
              </h2>
              <p className="text-sm text-slate-500">
                Are you sure you want to end your session?
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={executeLogout}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-600/20">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
