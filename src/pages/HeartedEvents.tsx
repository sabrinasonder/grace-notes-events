import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast } from "date-fns";
import { ArrowLeft, Heart, Users, Calendar } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { BottomNav } from "@/components/BottomNav";

const GRADIENTS = [
  "linear-gradient(135deg, #D89B86 0%, #B97A66 60%, #3A2A20 100%)",
  "linear-gradient(135deg, #B5C2A3 0%, #7E8C6F 60%, #3A2A20 100%)",
  "linear-gradient(135deg, #E8D5C4 0%, #A89684 60%, #1F1612 100%)",
  "linear-gradient(135deg, #F4D9C8 0%, #D89B86 60%, #3A2A20 100%)",
];

function getGradient(eventId: string) {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) hash = ((hash << 5) - hash + eventId.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const HeartedEvents = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { favorites, isFavorited, toggleFavorite } = useFavorites();

  const { data: events = [] } = useQuery({
    queryKey: ["hearted-events", favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const { data, error } = await supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status)")
        .in("id", favorites)
        .eq("status", "active")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && favorites.length > 0,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-espresso">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace />;

  const upcomingEvents = events.filter((e: any) => !isPast(new Date(e.starts_at)));
  const pastEvents = events.filter((e: any) => isPast(new Date(e.starts_at)));

  const renderCard = (event: any) => {
    const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
    const hostProfile = event.profiles;
    const eventDate = new Date(event.starts_at);

    return (
      <button
        key={event.id}
        onClick={() => navigate(`/event/${event.id}`)}
        className="w-full text-left rounded-3xl overflow-hidden shadow-sm bg-paper transition-transform active:scale-[0.98]"
      >
        <div className="relative h-44 w-full overflow-hidden">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: getGradient(event.id) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(event.id); }}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
          >
            <Heart className="h-4 w-4" strokeWidth={1.5} fill={isFavorited(event.id) ? "#D89B86" : "none"} color={isFavorited(event.id) ? "#D89B86" : "#3A2A20"} />
          </button>

          <div className="absolute bottom-4 left-4 right-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-white/90 mb-1">
              {format(eventDate, "EEE, MMM d · h:mm a")}
            </p>
            <h3 className="font-serif text-[26px] font-normal leading-[1.05] tracking-tight text-white">
              {event.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-cream px-5 py-4">
          <div className="flex items-center gap-2.5">
            {hostProfile?.avatar_url ? (
              <img src={hostProfile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[9px] text-espresso">
                {(hostProfile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-sans text-xs font-semibold text-cocoa">{hostProfile?.full_name || "Host"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-[13px] w-[13px] text-taupe" strokeWidth={1.5} />
            <span className="font-serif text-[15px] text-cocoa">{goingCount}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="mx-auto max-w-lg">
          <button onClick={() => navigate(-1)} className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="font-serif text-[30px] font-normal text-espresso" style={{ letterSpacing: "-0.02em" }}>
            Hearted Events
          </h1>
          <p className="font-sans text-sm text-taupe mt-1">Events you're keeping an eye on</p>
        </div>
      </div>

      <div className="px-6">
        <div className="mx-auto max-w-lg space-y-5">
          {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
            <div className="text-center py-16 space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream">
                <Heart className="h-7 w-7 text-taupe" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-xl text-espresso">No hearted events yet</h2>
                <p className="font-serif italic text-sm text-taupe">
                  Tap the heart on any event to save it for later.
                </p>
              </div>
            </div>
          ) : (
            <>
              {upcomingEvents.map(renderCard)}
              {pastEvents.length > 0 && (
                <div className="pt-4">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe mb-4">Past</p>
                  <div className="space-y-5 opacity-60">{pastEvents.map(renderCard)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default HeartedEvents;
