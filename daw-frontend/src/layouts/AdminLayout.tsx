import { useState, useEffect } from "react";
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
  Menu as MenuIcon,
} from "lucide-react";
import logoDaw from "../assets/logo-daw.png";

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [unreadInquiries, setUnreadInquiries] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnreadInquiries = async () => {
      try {
        const token = localStorage.getItem("daw_token");
        const res = await fetch("http://localhost:5000/api/inquiries", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const unread = data.filter((item: any) => !item.isRead);
          setUnreadInquiries(unread);
        }
      } catch (error) {
        console.error("Failed to fetch notifications");
        console.log(error);
      }
    };

    fetchUnreadInquiries();
    setIsNotifOpen(false);
  }, [location.pathname]);

  const userData = JSON.parse(localStorage.getItem("daw_user") || "{}");

  const executeLogout = () => {
    localStorage.removeItem("daw_token");
    localStorage.removeItem("daw_user");
    setIsLogoutModalOpen(false);
    navigate("/admin/login");
  };

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Homepage", path: "/admin/home", icon: MonitorPlay },
    { name: "Projects", path: "/admin/projects", icon: FolderTree },
    { name: "Businesses", path: "/admin/businesses", icon: Building2 },
    { name: "Investments", path: "/admin/investments", icon: Briefcase },
    { name: "About Us", path: "/admin/about", icon: Users },
    {
      name: "Inbox",
      path: "/admin/inbox",
      icon: Inbox,
      badge: unreadInquiries.length > 0 ? unreadInquiries.length : undefined,
    },
    { name: "Menu Manager", path: "/admin/menu-manager", icon: MenuIcon },
    { name: "User Access", path: "/admin/users", icon: Shield },
    { name: "Settings", path: "/admin/settings", icon: Settings },
  ];

  return (
    // Warna dasar background untuk seluruh area Admin Panel
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* --- 1. OVERLAY UNTUK MOBILE --- */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* --- 2. SIDEBAR  --- */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        flex flex-col /* <--- INI KUNCI UTAMANYA */
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 ${isDesktopCollapsed ? "md:w-[84px]" : "md:w-[260px] w-[260px]"}
      `}
      >
        {/* AREA LOGO (Warna Asli) */}
        <div className="h-20 flex items-center px-8 border-b border-slate-100">
          <img
            src={logoDaw}
            alt="DAW Admin Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* MENU NAVIGASI */}
        <nav className="flex-1 py-8 flex flex-col gap-2 overflow-y-auto custom-scrollbar px-3">
          <p
            className={`text-xs font-bold tracking-[0.2em] text-slate-400 uppercase mb-2 transition-all duration-300 ${isDesktopCollapsed ? "text-center text-[9px] opacity-0 md:opacity-100" : "px-2"}`}
          >
            {isDesktopCollapsed ? "Menu" : "Main Menu"}
          </p>

          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  relative flex items-center px-3 py-3 rounded-xl transition-all duration-200 group
                  ${isActive ? "bg-daw-green/10 text-daw-green font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-daw-green"}
                  ${isDesktopCollapsed ? "justify-center" : "justify-between"}
                `}
              >
                {/* Aksen garis kiri */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-daw-green rounded-r-full"></div>
                )}

                <div className="flex items-center">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${isActive ? "text-daw-green" : "text-slate-400 group-hover:text-daw-green"}`}
                  />
                  <span
                    className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0 ml-0" : "w-auto opacity-100 ml-3"}`}
                  >
                    {item.name}
                  </span>
                </div>
                {/* Badge Notifikasi */}
                {item.badge && (
                  <span
                    className={`bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 ${isDesktopCollapsed ? "absolute top-2 right-2 px-1.5 py-0.5 text-[8px]" : ""}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* AREA PROFIL & LOGOUT */}
        <div
          className={`p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-4 ${isDesktopCollapsed ? "items-center" : ""}`}
        >
          <div
            className={`flex items-center gap-3 ${isDesktopCollapsed ? "justify-center" : "px-2"}`}
          >
            <div className="w-10 h-10 shrink-0 rounded-full bg-daw-green text-white flex items-center justify-center font-bold shadow-sm">
              {userData.name ? userData.name.charAt(0) : "U"}
            </div>
            {/* Detail Profil Menghilang saat Collapsed */}
            <div
              className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}
            >
              <p className="text-sm font-bold text-slate-800 truncate">
                {userData.name || "Unknown User"}
              </p>
              <p className="text-[11px] text-slate-500 truncate uppercase tracking-wider">
                {userData.role || "Guest"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsLogoutModalOpen(true)}
            title={isDesktopCollapsed ? "Sign Out" : ""}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors shadow-sm ${isDesktopCollapsed ? "w-10 px-0" : "w-full"}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}
            >
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
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              className="hidden md:block p-2 -ml-2 text-slate-500 hover:text-daw-green hover:bg-slate-50 rounded-lg transition-colors"
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            >
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
                .filter((x) => x)
                .map((path, index, array) => {
                  const isLast = index === array.length - 1;
                  return (
                    <div key={path} className="flex items-center gap-2">
                      <span
                        className={`capitalize ${isLast ? "text-slate-900 font-bold" : "text-slate-400"}`}
                      >
                        {path.replace(/-/g, " ")}
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
              className={`p-2 rounded-full transition-colors relative ${isNotifOpen ? "bg-daw-green/10 text-daw-green" : "text-slate-400 hover:text-daw-green hover:bg-slate-50"}`}
            >
              <Bell className="w-5 h-5" />
              {unreadInquiries.length > 0 && (
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

                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {unreadInquiries.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                      {unreadInquiries.slice(0, 5).map((inq) => (
                        <div
                          key={inq.id}
                          className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setIsNotifOpen(false);
                            navigate("/admin/inbox");
                          }}
                        >
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

                {unreadInquiries.length > 0 && (
                  <div className="p-3 border-t border-slate-100 bg-white">
                    <button
                      onClick={() => {
                        setIsNotifOpen(false);
                        navigate("/admin/inbox");
                      }}
                      className="w-full py-2 text-sm font-bold text-daw-green hover:bg-daw-green/10 rounded-lg transition-colors"
                    >
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeLogout}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-600/20"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
