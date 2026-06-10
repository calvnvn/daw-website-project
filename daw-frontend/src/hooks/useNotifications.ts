import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface InquiryData {
  id: string | number;
  name: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface ApprovalData {
  id: string | number;
  [key: string]: any;
}

export function useNotifications() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();

  const hasInboxPerm = !!user && can("manage_inbox");
  const hasApprovalPerm = !!user && can("manage_approvals");

  // Fetch Inquiries
  const inquiriesQuery = useQuery<InquiryData[]>({
    queryKey: ["inquiries", user?.id],
    queryFn: async () => {
      const response = await api.get("/inquiries");
      const payload = response.data?.data || response.data;
      if (Array.isArray(payload)) {
        return payload.filter((item: InquiryData) => !item.isRead);
      }
      return [];
    },
    enabled: hasInboxPerm,
    refetchInterval: 1000 * 60 * 2, // 2 minutes polling
    staleTime: 1000 * 30, // 30 seconds
  });

  // Fetch Approvals
  const approvalsQuery = useQuery<ApprovalData[]>({
    queryKey: ["approvals", user?.id],
    queryFn: async () => {
      const response = await api.get("/approval/list");
      const rows = response.data?.data?.rows || [];
      return rows;
    },
    enabled: hasApprovalPerm,
    refetchInterval: 1000 * 60 * 2, // 2 minutes polling
    staleTime: 1000 * 30, // 30 seconds
  });

  const unreadInquiries = inquiriesQuery.data || [];
  const unreadApprovals = approvalsQuery.data || [];
  const isLoading = inquiriesQuery.isLoading || approvalsQuery.isLoading;

  const refetch = async () => {
    if (hasInboxPerm) await inquiriesQuery.refetch();
    if (hasApprovalPerm) await approvalsQuery.refetch();
  };

  const markInquiryAsRead = async (id: string | number) => {
    try {
      await api.put(`/inquiries/${id}/read`);
      // Invalidate query to trigger react-query UI refresh
      queryClient.invalidateQueries({ queryKey: ["inquiries", user?.id] });
    } catch (error) {
      console.error("Failed to mark inquiry as read:", error);
    }
  };

  return {
    unreadInquiries,
    unreadApprovals,
    isLoading,
    refetch,
    markInquiryAsRead,
  };
}
