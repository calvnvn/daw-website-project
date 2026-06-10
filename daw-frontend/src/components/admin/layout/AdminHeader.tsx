import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  Bell,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationPanel from "./NotificationPanel";

interface AdminHeaderProps {
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: (collapsed: boolean) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Dashboard",
  approvals: "Approval Center",
  projects: "Project List",
  users: "User Management",
  roles: "Access Control",
  settings: "Global Settings",
  home: "Homepage Editor",
  news: "News & Events",
  businesses: "Businesses",
  investments: "Investments",
  inbox: "Inbox",
  content: "Content Manager",
  about: "About Us",
  create: "New Data",
  edit: "Modify",
};

export default function AdminHeader({
  isDesktopCollapsed,
  setIsDesktopCollapsed,
  setIsMobileMenuOpen,
}: AdminHeaderProps) {
  const location = useLocation();
  const { unreadInquiries, unreadApprovals } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const isParamId = (path: string) => path.length > 20 || !isNaN(Number(path));
  const hasUnread = unreadInquiries.length > 0 || unreadApprovals.length > 0;

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-40 sticky top-0 transition-all">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Desktop Collapse/Expand Sidebar Toggle */}
        <button
          className="hidden md:block p-2 -ml-2 text-slate-500 hover:text-daw-green hover:bg-slate-55 rounded-lg transition-colors cursor-pointer"
          onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
        >
          {isDesktopCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-5 h-5" />
          )}
        </button>

        {/* Dynamic Breadcrumbs */}
        <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
          {location.pathname
            .split("/")
            .filter((x) => x && !isParamId(x))
            .map((path, index, array) => {
              const isLast = index === array.length - 1;
              const label = BREADCRUMB_LABELS[path] || path.replace(/-/g, " ");

              return (
                <div key={path} className="flex items-center gap-2">
                  <span
                    className={`capitalize ${isLast ? "text-slate-900 font-bold" : "text-slate-400"}`}
                  >
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

      {/* Action Icons */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={() => setIsNotifOpen(!isNotifOpen)}
          className={`p-2 rounded-full transition-colors relative cursor-pointer ${
            isNotifOpen
              ? "bg-daw-green/10 text-daw-green"
              : "text-slate-400 hover:text-daw-green hover:bg-slate-50"
          }`}
        >
          <Bell className="w-5 h-5" />
          {hasUnread && (
            <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </button>

        {/* Notification Panel Dropdown */}
        {isNotifOpen && (
          <NotificationPanel onClose={() => setIsNotifOpen(false)} />
        )}
      </div>
    </header>
  );
}
