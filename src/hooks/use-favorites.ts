import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_favorites")
        .select("event_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((f) => f.event_id);
    },
    enabled: !!user,
  });

  const toggleFavorite = useMutation({
    mutationFn: async (eventId: string) => {
      const isFav = favorites.includes(eventId);
      if (isFav) {
        const { error } = await supabase
          .from("event_favorites")
          .delete()
          .eq("user_id", user!.id)
          .eq("event_id", eventId);
        if (error) throw error;
        return { action: "removed" as const };
      } else {
        const { error } = await supabase
          .from("event_favorites")
          .insert({ user_id: user!.id, event_id: eventId });
        if (error) throw error;
        return { action: "added" as const };
      }
    },
    onMutate: async (eventId: string) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", user?.id] });
      const prev = queryClient.getQueryData<string[]>(["favorites", user?.id]) || [];
      const next = prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId];
      queryClient.setQueryData(["favorites", user?.id], next);
      return { prev };
    },
    onError: (_err, _eventId, context) => {
      if (context?.prev) queryClient.setQueryData(["favorites", user?.id], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["hearted-events"] });
    },
  });

  return {
    favorites,
    isFavorited: (eventId: string) => favorites.includes(eventId),
    toggleFavorite: (eventId: string) => toggleFavorite.mutate(eventId),
  };
}
