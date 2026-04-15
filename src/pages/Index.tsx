import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { format, isToday, addDays, isBefore, isAfter } from "date-fns";
import { Plus, Calendar, MapPin, Users, Heart, Home, User, Sparkles } from "lucide-react";

type FilterMode = "going" | "hosting";

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<FilterMode>("going");

  // Profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status)")
        .gte("starts_at", new Date().toISOString())
        .eq("status", "active")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // My RSVPs
  const { data: myRsvps = [] } = useQuery({
    queryKey: ["my-rsvps", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("event_id, status")
        .eq("user_id", user!.id)
        .in("status", ["going", "maybe"]);
      return data || [];
    },
    enabled: !!user,
  });

  // Pending RSVP requests for events I host
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-rsvp-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvp_requests")
        .select("id, event_id")
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user,
  });

  const myRsvpEventIds = useMemo(() => new Set(myRsvps.map((r) => r.event_id)), [myRsvps]);

  const filteredEvents = useMemo(() => {
    if (mode === "hosting") return events.filter((e: any) => e.host_id === user?.id);
    return events.filter((e: any) => myRsvpEventIds.has(e.id));
  }, [events, mode, user?.id, myRsvpEventIds]);

  // Group events
  const now = new Date();
  const endOfWeek = addDays(now, 7);
  const todayEvents = filteredEvents.filter((e: any) => isToday(new Date(e.starts_at)));
  const thisWeekEvents = filteredEvents.filter((e: any) => {
    const d = new Date(e.starts_at);
    return !isToday(d) && isBefore(d, endOfWeek);
  });
  const comingUpEvents = filteredEvents.filter((e: any) => !isBefore(new Date(e.starts_at), endOfWeek));

  // Activity summary
  const hostingCount = events.filter((e: any) => e.host_id === user?.id).length;
  const pendingCount = pendingRequests.filter((r: any) =>
    events.some((e: any) => e.id === r.event_id && e.host_id === user?.id)
  ).length;
  const attendingCount = events.filter((e: any) => myRsvpEventIds.has(e.id)).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-espresso">Sonder Circle</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const renderEventCard = (event: any) => {
    const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
    const hostProfile = event.profiles;
    const eventDate = new Date(event.starts_at);
    const isHost = event.host_id === user?.id;

    return (
      <button
        key={event.id}
        onClick={() => navigate(`/event/${event.id}`)}
        className="w-full text-left rounded-3xl overflow-hidden shadow-sm bg-paper transition-transform active:scale-[0.98]"
      >
        {/* Hero zone */}
        <div className="relative h-44 w-full overflow-hidden">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: getGradient(event.id) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Top-left pills */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="rounded-full bg-cocoa px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-background">
              {event.price_cents > 0 ? `$${(event.price_cents / 100).toFixed(0)}` : "Free"}
            </span>
            {isHost && (
              <span className="rounded-full bg-blush px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-white">
                You're hosting
              </span>
            )}
          </div>

          {/* Top-right heart placeholder */}
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
          >
            <Heart className="h-4 w-4 text-cocoa" strokeWidth={1.5} />
          </button>

          {/* Bottom overlay text */}
          <div className="absolute bottom-4 left-4 right-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-white/90 mb-1">
              {format(eventDate, "EEE, MMM d · h:mm a")}
            </p>
            <h3 className="font-serif text-[26px] font-normal leading-[1.05] tracking-tight text-white">
              {event.title}
            </h3>
          </div>
        </div>

        {/* Bottom attribution zone */}
        <div className="flex items-center justify-between border-t border-cream px-5 py-4">
          <div className="flex items-center gap-2.5">
            {hostProfile?.avatar_url ? (
              <img src={hostProfile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[9px] text-espresso">
                {(hostProfile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-sans text-xs font-semibold text-cocoa">{hostProfile?.full_name || "Host"}</span>
              {event.location && (
                <span className="font-sans text-[11px] text-taupe truncate max-w-[180px]">{event.location.split(",")[0]}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-[13px] w-[13px] text-taupe" strokeWidth={1.5} />
            <span className="font-serif text-[15px] text-cocoa">{goingCount}</span>
          </div>
        </div>
      </button>
    );
  };

  const renderSectionHeader = (title: string, showSeeAll?: boolean) => (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="font-serif text-[22px] font-normal text-espresso" style={{ letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      {showSeeAll && (
        <button className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe">
          See all
        </button>
      )}
    </div>
  );

  const isHomePage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Editorial greeting header */}
      <div className="px-6 pt-8 pb-5">
        <div className="mx-auto max-w-lg">
          {/* Top row: date + mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-taupe">
              {format(now, "EEEE, MMMM d")}
            </p>
            <button
              onClick={() => setMode(mode === "going" ? "hosting" : "going")}
              className="rounded-full border border-cocoa px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cocoa/5"
            >
              {mode === "going" ? "Going" : "Hosting"}
            </button>
          </div>

          {/* Greeting */}
          <h1 className="font-serif text-[38px] font-normal text-espresso leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
            {getGreeting()}
          </h1>
          <p className="font-serif italic text-[38px] font-normal text-cocoa leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
            {firstName}
          </p>

          {/* Activity summary */}
          <div className="flex items-center gap-1.5 mt-4">
            <Sparkles className="h-3.5 w-3.5 text-blush flex-shrink-0" strokeWidth={1.5} />
            <p className="font-sans text-xs text-cocoa">
              {mode === "hosting" ? (
                <>
                  {hostingCount} event{hostingCount !== 1 ? "s" : ""} you're hosting
                  {pendingCount > 0 && <> · {pendingCount} RSVP{pendingCount !== 1 ? "s" : ""} to review</>}
                </>
              ) : (
                <>
                  {attendingCount} upcoming
                  {myRsvps.filter(r => r.status === "maybe").length > 0 && (
                    <> · {myRsvps.filter(r => r.status === "maybe").length} need{myRsvps.filter(r => r.status === "maybe").length !== 1 ? "" : "s"} your reply</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Event cards */}
      <div className="px-6">
        <div className="mx-auto max-w-lg space-y-8">
          {eventsLoading ? (
            <div className="space-y-5">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-3xl bg-cream h-56" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16 space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream">
                <Calendar className="h-7 w-7 text-taupe" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-xl text-espresso">
                  {mode === "hosting" ? "You're not hosting any events" : "No upcoming events"}
                </h2>
                <p className="font-serif italic text-sm text-taupe">
                  {mode === "hosting" ? "Create your first gathering." : "RSVP to an event to see it here."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {todayEvents.length > 0 && (
                <div>
                  {renderSectionHeader("Today")}
                  <div className="space-y-5">{todayEvents.map(renderEventCard)}</div>
                </div>
              )}
              {thisWeekEvents.length > 0 && (
                <div>
                  {renderSectionHeader("This Week")}
                  <div className="space-y-5">{thisWeekEvents.map(renderEventCard)}</div>
                </div>
              )}
              {comingUpEvents.length > 0 && (
                <div>
                  {renderSectionHeader("Coming Up")}
                  <div className="space-y-5">{comingUpEvents.map(renderEventCard)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-cream bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-around px-6 py-3" style={{ height: 70 }}>
          {/* Home */}
          <button
            onClick={() => navigate("/")}
            className="flex flex-col items-center gap-1"
          >
            <Home className={`h-[22px] w-[22px] ${isHomePage ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
          </button>

          {/* Create — floating circle */}
          <button
            onClick={() => navigate("/create")}
            className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-cocoa shadow-lg transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5 text-background" strokeWidth={2} />
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate("/settings")}
            className="flex flex-col items-center gap-1"
          >
            <User className={`h-[22px] w-[22px] ${location.pathname === "/settings" ? "text-cocoa" : "text-taupe"}`} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
