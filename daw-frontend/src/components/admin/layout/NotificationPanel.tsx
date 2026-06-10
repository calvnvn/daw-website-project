import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  ClipboardCheck,
  Check,
  ArrowRight,
  Bell,
  Clock,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { unreadInquiries, unreadApprovals, markInquiryAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<"all" | "approvals" | "inbox">("all");

  const panelRef = useClickOutside<HTMLDivElement>(onClose);

  // Relative time helper
  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (isNaN(date.getTime())) return "Recently";
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${diffDays}d ago`;
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unreadInquiries.length === 0) return;
    const promises = unreadInquiries.map((inq) => markInquiryAsRead(inq.id));
    await Promise.all(promises);
  };

  const handleInquiryClick = () => {
    onClose();
    if (can("manage_inbox")) {
      navigate("/admin/inbox");
    }
  };

  const handleApprovalClick = () => {
    onClose();
    navigate("/admin/approvals");
  };

  // Filtered Notifications based on active tab
  const displayInquiries = useMemo(() => {
    if (activeTab === "approvals") return [];
    return unreadInquiries;
  }, [activeTab, unreadInquiries]);

  const displayApprovals = useMemo(() => {
    if (activeTab === "inbox") return [];
    return unreadApprovals;
  }, [activeTab, unreadApprovals]);

  const totalNotificationsCount = unreadInquiries.length + unreadApprovals.length;

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-4 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 ring-1 ring-black/5 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200"
    >
      {/* Header and Tabs */}
      <div className="px-5 pt-4 bg-slate-50/50 border-b border-slate-100">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800 text-base">Notifications</h3>
          {unreadInquiries.length > 0 && activeTab !== "approvals" && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-bold text-daw-green hover:text-emerald-700 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-4 text-xs font-bold border-b border-slate-100">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-2 transition-colors relative ${
              activeTab === "all" ? "text-daw-green" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            All
            {totalNotificationsCount > 0 && (
              <span className="ml-1 bg-daw-green/10 text-daw-green px-1.5 py-0.5 rounded-full text-[10px]">
                {totalNotificationsCount}
              </span>
            )}
            {activeTab === "all" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-daw-green rounded-full" />
            )}
          </button>

          {unreadApprovals.length > 0 && (
            <button
              onClick={() => setActiveTab("approvals")}
              className={`pb-2 transition-colors relative ${
                activeTab === "approvals" ? "text-daw-green" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Approvals
              <span className="ml-1 bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">
                {unreadApprovals.length}
              </span>
              {activeTab === "approvals" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-daw-green rounded-full" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab("inbox")}
            className={`pb-2 transition-colors relative ${
              activeTab === "inbox" ? "text-daw-green" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Messages
            {unreadInquiries.length > 0 && (
              <span className="ml-1 bg-daw-green/10 text-daw-green px-1.5 py-0.5 rounded-full text-[10px]">
                {unreadInquiries.length}
              </span>
            )}
            {activeTab === "inbox" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-daw-green rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        {totalNotificationsCount === 0 || 
        (activeTab === "approvals" && unreadApprovals.length === 0) || 
        (activeTab === "inbox" && unreadInquiries.length === 0) ? (
          /* Empty State */
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
              <Bell className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">All caught up!</h4>
            <p className="text-xs text-slate-400 mt-1">
              You have no new notifications to review.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Approvals Section */}
            {displayApprovals.map((_, index) => (
              <div
                key={`approval-${index}`}
                onClick={handleApprovalClick}
                className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer group flex items-start gap-3 bg-blue-50/30"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                    Pending Approval
                  </p>
                  <p className="text-sm font-bold text-slate-800 leading-snug">
                    Draf revisi baru masuk
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                    Silakan periksa detail draf revisi di halaman approval.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all self-center" />
              </div>
            ))}

            {/* Inquiries Section */}
            {displayInquiries.map((inq) => (
              <div
                key={`inquiry-${inq.id}`}
                onClick={handleInquiryClick}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-3 relative"
              >
                {/* Active Indicator */}
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-daw-green rounded-full shadow-sm" />

                <div className="w-9 h-9 rounded-full bg-emerald-50 text-daw-green flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {inq.name}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {getRelativeTime(inq.createdAt as string)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 truncate">
                    {inq.subject}
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-1 font-medium">
                    {inq.message}
                  </p>
                </div>

                {/* Quick actions: Mark as read */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await markInquiryAsRead(inq.id);
                    }}
                    title="Mark as read"
                    className="p-1.5 bg-white shadow-md border border-slate-100 rounded-full text-slate-400 hover:text-daw-green hover:border-daw-green transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {totalNotificationsCount > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              onClose();
              navigate(unreadApprovals.length > 0 ? "/admin/approvals" : "/admin/inbox");
            }}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            View All Notifications <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
