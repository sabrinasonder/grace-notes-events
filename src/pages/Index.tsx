import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format, isToday, addDays, isBefore } from "date-fns";
import { Plus, Calendar, MapPin, Users, UserPlus, Settings, LogOut, Archive } from "lucide-react";

type FilterTab = "all" | "hosting" | "attending";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", filter, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status)")
        .gte("starts_at", new Date().toISOString())
        .eq("status", "active")
        .order("starts_at", { ascending: true });

      if (filter === "hosting") {
        query = query.eq("host_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (filter === "attending") {
        const { data: myRsvps } = await supabase
          .from("rsvps")
          .select("event_id")
          .eq("user_id", user!.id)
          .in("status", ["going", "maybe"]);
        const myEventIds = new Set(myRsvps?.map((r) => r.event_id));
        return (data || []).filter((e) => myEventIds.has(e.id));
      }

      return data || [];
    },
    enabled: !!user,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-espresso">Sonder Circle</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "hosting", label: "Hosting" },
    { key: "attending", label: "Attending" },
  ];

  const now = new Date();
  const endOfWeek = addDays(now, 7);
  const thisWeekEvents = events.filter((e: any) => isBefore(new Date(e.starts_at), endOfWeek));
  const comingUpEvents = events.filter((e: any) => !isBefore(new Date(e.starts_at), endOfWeek));

  const renderEventCard = (event: any) => {
    const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
    const hostProfile = event.profiles;
    const eventDate = new Date(event.starts_at);
    const isEventToday = isToday(eventDate);
    const hostInitials = (hostProfile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();

    return (
      <button
        key={event.id}
        onClick={() => navigate(`/event/${event.id}`)}
        className="w-full text-left overflow-hidden transition-transform active:scale-[0.98]"
      >
        {/* Cover image */}
        <div className="relative h-48 w-full overflow-hidden rounded-2xl">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "linear-gradient(135deg, #B5C2A3 0%, #7E8C6F 60%, #3A2A20 100%)" }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Pills on image */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {isEventToday && (
              <span className="rounded-full bg-blush px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-white">
                Today
              </span>
            )}
            <span className="rounded-full bg-cocoa/70 px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
              {event.price_cents > 0 ? `$${(event.price_cents / 100).toFixed(0)}` : "Free"}
            </span>
          </div>

          {/* Title overlay at bottom of image */}
          <div className="absolute bottom-3 left-3 right-3">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.25em] text-white/70 mb-0.5">
              {format(eventDate, "EEEE · h:mm a")}
            </p>
            <h3 className="font-serif text-[22px] font-light leading-tight text-white">
              {event.title}
            </h3>
          </div>
        </div>

        {/* Meta row below image */}
        <div className="flex items-center gap-4 px-1 pt-3 pb-1">
          {/* Host */}
          <div className="flex items-center gap-1.5">
            {hostProfile?.avatar_url ? (
              <img src={hostProfile.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[8px] text-espresso">
                {hostInitials}
              </div>
            )}
            <span className="font-sans text-xs text-cocoa">{hostProfile?.full_name || "Host"}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1 text-taupe">
              <MapPin className="h-3 w-3" strokeWidth={1.5} />
              <span className="font-sans text-xs truncate max-w-[120px]">{event.location.split(",")[0]}</span>
            </div>
          )}

          {/* Going count */}
          <div className="flex items-center gap-1 ml-auto text-taupe">
            <Users className="h-3 w-3" strokeWidth={1.5} />
            <span className="font-sans text-xs">{goingCount}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Top nav bar */}
      <div className="sticky top-0 left-0 right-0 border-b border-cream bg-background/80 backdrop-blur-lg z-20">
        <div className="mx-auto flex max-w-lg items-center justify-center px-6 py-3 gap-3">
          <button
            onClick={() => navigate("/invite")}
            className="rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa hover:bg-cream/80 transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="h-3 w-3" strokeWidth={1.5} />
            Invite
          </button>
          <button
            onClick={() => navigate("/archive")}
            className="rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa hover:bg-cream/80 transition-colors flex items-center gap-1.5"
          >
            <Archive className="h-3 w-3" strokeWidth={1.5} />
            Archive
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa hover:bg-cream/80 transition-colors flex items-center gap-1.5"
          >
            <Settings className="h-3 w-3" strokeWidth={1.5} />
            Settings
          </button>
          <button
            onClick={signOut}
            className="rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa hover:bg-cream/80 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="h-3 w-3" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="px-6 pt-10 pb-2">
        <div className="mx-auto max-w-lg">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-taupe">Welcome back</p>
          <h1 className="font-serif text-[34px] font-light tracking-tight text-espresso mt-1">
            Sonder Circle
          </h1>
        </div>
      </div>

      {/* Filter tabs — flat editorial */}
      <div className="px-6 pb-6 pt-4">
        <div className="mx-auto max-w-lg flex border-b border-cream">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`relative px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                filter === f.key
                  ? "text-espresso"
                  : "text-taupe hover:text-cocoa"
              }`}
            >
              {f.label}
              {filter === f.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cocoa" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Event cards */}
      <div className="px-6">
        <div className="mx-auto max-w-lg space-y-8">
          {eventsLoading ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-cream h-48" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream">
                <Calendar className="h-7 w-7 text-taupe" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-xl text-espresso">No events on the calendar yet</h2>
                <p className="font-serif italic text-sm text-taupe">Be the first to host something.</p>
              </div>
              <button
                onClick={() => navigate("/create")}
                className="inline-flex items-center gap-2 rounded-full bg-cocoa px-6 py-3 transition-all hover:opacity-90"
              >
                <Plus className="h-4 w-4 text-background" strokeWidth={2} />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background">Create Event</span>
              </button>
            </div>
          ) : (
            <>
              {thisWeekEvents.length > 0 && (
                <div className="space-y-5">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">This Week</p>
                  {thisWeekEvents.map(renderEventCard)}
                </div>
              )}
              {comingUpEvents.length > 0 && (
                <div className="space-y-5">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Coming Up</p>
                  {comingUpEvents.map(renderEventCard)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={() => navigate("/create")}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-cocoa px-6 py-3.5 shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4 text-background" strokeWidth={2} />
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background">
            Create Event
          </span>
        </button>
      </div>
    </div>
  );
};

export default Index;
