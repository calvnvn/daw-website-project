import { useState } from "react";
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
} from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

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
    { name: "Investments", path: "/admin/investments", icon: Briefcase },
    { name: "About Us", path: "/admin/about", icon: Users },
    { name: "Inbox", path: "/admin/inbox", icon: Inbox },
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
            {/* Tombol Toggle Mobile (Muncul di layar kecil) */}
            <button
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Tombol Toggle Desktop (Muncul di layar besar) */}
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

            <div>
              <h2 className="text-xl font-serif font-bold text-slate-800 hidden sm:block">
                PT Dharma Agung Wijaya
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-daw-green hover:bg-slate-50 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
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
