import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderTree,
  Inbox,
  Settings,
  LogOut,
  Users,
  MonitorPlay,
  Shield,
  Briefcase,
  AlertTriangle,
  Building2,
  FileText,
  ClipboardCheck,
  Newspaper,
} from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

interface AdminSidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isDesktopCollapsed: boolean;
}

const MENU_GROUPS = [
  {
    label: "Main Desk",
    items: [
      { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
      {
        name: "Approval Center",
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

export default function AdminSidebar({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isDesktopCollapsed,
}: AdminSidebarProps) {
  const { settings } = useSettings();
  const { can, user, logout } = useAuth();
  const { unreadInquiries, unreadApprovals } = useNotifications();
  const location = useLocation();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const executeLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
  };

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
    <>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col h-full
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 ${isDesktopCollapsed ? "md:w-[84px]" : "md:w-[260px]"}
        `}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center px-8 border-b border-slate-100 shrink-0">
          <img
            src={
              settings?.logoUrl ? getCleanImageUrl(settings.logoUrl) : logoDaw
            }
            alt="DAW Admin Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto custom-scrollbar px-3">
          {filteredMenuGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? "mt-4" : ""}>
              {/* Group Header */}
              <p
                className={`text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-2 px-3 transition-all duration-300 ${
                  isDesktopCollapsed
                    ? "h-0 overflow-hidden opacity-0 m-0 p-0"
                    : "opacity-100"
                }`}
              >
                {group.label}
              </p>

              {/* Group Items */}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  // Dynamic badge assignment (Bug fixed: Checked for both "Approval Center" and "Approval Queue")
                  const dynamicBadge =
                    item.name === "Inbox" && unreadInquiries.length > 0
                      ? unreadInquiries.length
                      : (item.name === "Approval Center" || item.name === "Approval Queue") &&
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
                      `}
                    >
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
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* Notification Badge */}
                      {dynamicBadge && !isDesktopCollapsed && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          {dynamicBadge}
                        </span>
                      )}
                      
                      {/* Small Indicator if Collapsed */}
                      {dynamicBadge && isDesktopCollapsed && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile and Logout Area */}
        <div
          className={`p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-4 ${isDesktopCollapsed ? "items-center" : ""}`}
        >
          <div
            className={`flex items-center gap-3 ${isDesktopCollapsed ? "justify-center" : "px-2"}`}
          >
            <div className="w-10 h-10 shrink-0 rounded-full bg-daw-green text-white flex items-center justify-center font-bold shadow-sm uppercase">
              {user?.name ? user.name.charAt(0) : "U"}
            </div>
            
            <div
              className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${isDesktopCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}
            >
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
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors shadow-sm cursor-pointer ${isDesktopCollapsed ? "w-10 px-0" : "w-full"}`}
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

      {/* Logout Confirmation Modal */}
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
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeLogout}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-600/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
