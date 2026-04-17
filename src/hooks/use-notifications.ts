import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type NotificationType =
  | "event_invite"
  | "payment_reminder"
  | "event_update"
  | "membership_request"
  | "membership_approved"
  | "welcome";

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  related_event_id: string | null;
  related_user_id: string | null;
  action_url: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as AppNotification[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications" as any)
        .update({ is_read: true })
        .eq("id", id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications" as any)
        .update({ is_dismissed: true })
        .eq("id", id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("notifications" as any)
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead: (id: string) => markRead.mutate(id),
    dismiss: (id: string) => dismiss.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
