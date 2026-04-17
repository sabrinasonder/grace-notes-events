import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo, useRef, useEffect } from "react";
import { format, isToday, addDays, isBefore } from "date-fns";
import { Calendar, Users, Heart, Sparkles, Share2, UserCheck, Lock, Repeat, Bell, CreditCard, UserPlus, X, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFavorites } from "@/hooks/use-favorites";
import { BottomNav } from "@/components/BottomNav";
import { useNotifications } from "@/hooks/use-notifications";

type FilterMode = "all" | "going" | "hosting";

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
  const { user, loading, membershipStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<FilterMode>("all");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const hasSetInitialMode = useRef(false);
  const { favorites, isFavorited, toggleFavorite } = useFavorites();
  const queryClient = useQueryClient();
  const heartedScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { unreadCount } = useNotifications();
  const [dismissedBanners, setDismissBanner] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("dismissed_banners") || "[]")); }
    catch { return new Set(); }
  });
  const dismissBanner = (key: string) => {
    setDismissBanner((prev) => {
      const next = new Set(prev).add(key);
      sessionStorage.setItem("dismissed_banners", JSON.stringify([...next]));
      return next;
    });
  };

  const requestAccessMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("rsvp_requests").insert({
        event_id: eventId,
        user_id: user!.id,
        message: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-rsvp-requests", user?.id] });
      toast({ title: "Request sent!", description: "The host will review your request." });
      setRequestingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
      setRequestingId(null);
    },
  });

  const handleShare = async (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied!" });
      } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
    }
  };

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
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status), event_hosts(user_id)")
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

  // Hearted events data
  const { data: heartedEvents = [] } = useQuery({
    queryKey: ["hearted-events", favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const { data, error } = await supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url)")
        .in("id", favorites)
        .gte("starts_at", new Date().toISOString())
        .eq("status", "active")
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && favorites.length > 0,
  });

  // My own rsvp requests (to know which events I already requested)
  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-rsvp-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvp_requests")
        .select("event_id, status")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // ── Banner data ────────────────────────────────────────────────────────────

  // Is the current user an admin?
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("has_role", { user_id: user!.id, role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  // Pending membership requests (admin only)
  const { data: pendingMemberCount = 0 } = useQuery({
    queryKey: ["pending_member_count"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("membership_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    enabled: !!user && isAdmin,
  });

  // Pending event invites for the current user
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["pending-event-invites-banner", user?.id],
    queryFn: async () => {
      const { data: invites } = await supabase
        .from("event_invites")
        .select("id, event_id, invited_by")
        .eq("invited_user_id", user!.id)
        .eq("status", "pending" as any);
      if (!invites?.length) return [];
      const eventIds = invites.map((i: any) => i.event_id);
      const inviterIds = [...new Set(invites.map((i: any) => i.invited_by))] as string[];
      const [{ data: evts }, { data: pfs }, { data: userRsvps }] = await Promise.all([
        supabase.from("events").select("id, title, starts_at").in("id", eventIds),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", inviterIds),
        supabase.from("rsvps").select("event_id").eq("user_id", user!.id).in("event_id", eventIds),
      ]);
      // Filter out invites for events the user has already RSVPd to
      const rsvpdEventIds = new Set((userRsvps || []).map((r: any) => r.event_id));
      return invites
        .filter((inv: any) => !rsvpdEventIds.has(inv.event_id))
        .map((inv: any) => ({
          ...inv,
          event: evts?.find((e: any) => e.id === inv.event_id) ?? null,
          inviter: pfs?.find((p: any) => p.id === inv.invited_by) ?? null,
        }));
    },
    enabled: !!user,
  });

  // Unpaid RSVPs for upcoming paid events
  const { data: unpaidRsvps = [] } = useQuery({
    queryKey: ["unpaid-rsvps-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("event_id, paid, events!inner(id, title, price_cents, starts_at)")
        .eq("user_id", user!.id)
        .eq("status", "going")
        .eq("paid", false);
      return ((data || []) as any[]).filter(
        (r: any) => r.events?.price_cents > 0 && new Date(r.events?.starts_at) > new Date()
      );
    },
    enabled: !!user,
  });

  // ── Pending RSVP requests for events I host ──────────────────────────────
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

  // Auto-select the most relevant mode on first load once data arrives
  useEffect(() => {
    if (eventsLoading || hasSetInitialMode.current || !user) return;
    if (events.length === 0) return;
    hasSetInitialMode.current = true;
    const isHostingAny = events.some((e: any) => e.host_id === user.id);
    if (isHostingAny) { setMode("hosting"); return; }
    const hasRsvps = events.some((e: any) => myRsvpEventIds.has(e.id));
    if (hasRsvps) { setMode("going"); return; }
    // Otherwise stay on "all" — member can see everything available to them
  }, [eventsLoading, events, user, myRsvpEventIds]);

  const filteredEvents = useMemo(() => {
    if (mode === "hosting") return events.filter((e: any) => e.host_id === user?.id);
    if (mode === "going") return events.filter((e: any) => myRsvpEventIds.has(e.id));
    return events; // "all" — show everything visible to this user
  }, [events, mode, user?.id, myRsvpEventIds]);

  // For recurring series, only show the next upcoming instance (events are already sorted ASC)
  const deduplicatedEvents = useMemo(() => {
    const seriesSeen = new Set<string>();
    const result: any[] = [];
    for (const event of filteredEvents) {
      const isRecurring = !!(event.is_recurring_parent || event.parent_event_id);
      if (!isRecurring) {
        result.push(event);
        continue;
      }
      const seriesId: string = event.parent_event_id ?? event.id;
      if (!seriesSeen.has(seriesId)) {
        seriesSeen.add(seriesId);
        result.push(event);
      }
    }
    return result;
  }, [filteredEvents]);

  // Group events
  const now = new Date();
  const endOfWeek = addDays(now, 7);
  const todayEvents = deduplicatedEvents.filter((e: any) => isToday(new Date(e.starts_at)));
  const thisWeekEvents = deduplicatedEvents.filter((e: any) => {
    const d = new Date(e.starts_at);
    return !isToday(d) && isBefore(d, endOfWeek);
  });
  const comingUpEvents = deduplicatedEvents.filter((e: any) => !isBefore(new Date(e.starts_at), endOfWeek));

  // Activity summary
  const hostingCount = deduplicatedEvents.filter((e: any) => e.host_id === user?.id).length;
  const pendingCount = pendingRequests.filter((r: any) =>
    events.some((e: any) => e.id === r.event_id && e.host_id === user?.id)
  ).length;
  const attendingCount = deduplicatedEvents.filter((e: any) => myRsvpEventIds.has(e.id)).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-espresso">Sonder Circle</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/join" replace />;

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const renderEventCard = (event: any) => {
    const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
    const hostProfile = event.profiles;
    const coHosts: any[] = event.event_hosts || [];
    // event_hosts no longer carries nested profiles — always use primary host profile
    const allHosts = [hostProfile].filter(Boolean);
    void coHosts; // co-host user_ids available if needed in future
    const hostFirstNames = allHosts.map((h: any) => (h?.full_name || "Host").split(" ")[0]);
    const hostDisplayName = hostFirstNames.length === 0
      ? "Host"
      : hostFirstNames.length === 1
        ? allHosts[0]?.full_name || "Host"
        : hostFirstNames.length === 2
          ? `${hostFirstNames[0]} & ${hostFirstNames[1]}`
          : `${hostFirstNames[0]}, ${hostFirstNames[1]} +${hostFirstNames.length - 2}`;
    const primaryHost = allHosts[0] ?? hostProfile;
    const eventDate = new Date(event.starts_at);
    const isHost = event.host_id === user?.id;
    const hasRsvp = myRsvpEventIds.has(event.id);
    const isRestricted = event.privacy === "request_to_join" || event.privacy === "invite_only";
    const myReq = myRequests.find((r: any) => r.event_id === event.id);
    const alreadyRequested = !!myReq;
    const showRequestPill = isRestricted && !isHost && !hasRsvp;

    return (
      <button
        key={event.id}
        onClick={() => navigate(`/event/${event.id}`)}
        className="w-full text-left rounded-3xl overflow-hidden shadow-sm bg-paper transition-transform active:scale-[0.98]"
      >
        {/* Hero zone */}
        <div className="relative h-44 w-full overflow-hidden">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" style={{ objectPosition: (event as any).cover_image_position || "50% 50%" }} />
          ) : (
            <div className="h-full w-full" style={{ background: getGradient(event.id) }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Top-left pills */}
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap max-w-[65%]">
            <span className="rounded-full bg-cocoa px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-background">
              {event.price_cents > 0 ? `$${(event.price_cents / 100).toFixed(0)}` : "Free"}
            </span>
            {(event.parent_event_id || event.is_recurring_parent) && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                <Repeat className="h-2.5 w-2.5" strokeWidth={2} />
                Recurring
              </span>
            )}
            {isHost && (
              <span className="rounded-full bg-blush px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-white">
                You're hosting
              </span>
            )}
            {showRequestPill && (
              alreadyRequested ? (
                <span className="rounded-full bg-white/90 px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-taupe">
                  {myReq.status === "pending" ? "Pending" : myReq.status === "declined" ? "Declined" : "Requested"}
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRequestingId(event.id);
                    requestAccessMutation.mutate(event.id);
                  }}
                  disabled={requestingId === event.id}
                  className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-cocoa hover:bg-white transition-colors disabled:opacity-60"
                >
                  {event.privacy === "invite_only"
                    ? <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                    : <UserCheck className="h-2.5 w-2.5" strokeWidth={2} />}
                  {requestingId === event.id ? "Sending…" : "Request"}
                </button>
              )
            )}
          </div>

          {/* Top-right actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={(e) => handleShare(e, event)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
            >
              <Share2 className="h-3.5 w-3.5 text-cocoa" strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(event.id); }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
            >
              <Heart
                className="h-4 w-4"
                strokeWidth={1.5}
                fill={isFavorited(event.id) ? "#D89B86" : "none"}
                color={isFavorited(event.id) ? "#D89B86" : "#3A2A20"}
              />
            </button>
          </div>

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
            {primaryHost?.avatar_url ? (
              <img src={primaryHost.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[9px] text-espresso">
                {(primaryHost?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-sans text-xs font-semibold text-cocoa">{hostDisplayName}</span>
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

  const renderSectionHeader = (title: string, onSeeAll?: () => void) => (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="font-serif text-[22px] font-normal text-espresso" style={{ letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      {onSeeAll && (
        <button onClick={onSeeAll} className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe">
          See all
        </button>
      )}
    </div>
  );

  const isHomePage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Editorial greeting header */}
      <div className="px-6 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 32px)" }}>
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-taupe">
              {format(now, "EEEE, MMMM d")}
            </p>
            <div className="flex items-center gap-2">
              {/* Search icon */}
              <button
                onClick={() => navigate("/search")}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream transition-colors"
                aria-label="Search events"
              >
                <Search className="h-[18px] w-[18px] text-cocoa" strokeWidth={1.5} />
              </button>
              {/* Notification bell */}
              <button
                onClick={() => navigate("/notifications")}
                className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-cream transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px] text-cocoa" strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blush border border-background" />
                )}
              </button>
              {/* Mode toggle */}
              <button
                onClick={() => setMode(mode === "all" ? "going" : mode === "going" ? "hosting" : "all")}
                className="rounded-full border border-cocoa px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cocoa/5"
              >
                {mode === "all" ? "All" : mode === "going" ? "Going" : "Hosting"}
              </button>
            </div>
          </div>

          <h1 className="font-serif text-[38px] font-normal text-espresso leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
            {getGreeting()}
          </h1>
          <p className="font-serif italic text-[38px] font-normal text-cocoa leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
            {firstName}
          </p>

          <div className="flex items-center gap-1.5 mt-4">
            <Sparkles className="h-3.5 w-3.5 text-blush flex-shrink-0" strokeWidth={1.5} />
            <p className="font-sans text-xs text-cocoa">
              {mode === "hosting" ? (
                <>
                  {hostingCount} event{hostingCount !== 1 ? "s" : ""} you're hosting
                  {pendingCount > 0 && <> · {pendingCount} RSVP{pendingCount !== 1 ? "s" : ""} to review</>}
                </>
              ) : mode === "going" ? (
                <>
                  {attendingCount} upcoming
                  {myRsvps.filter(r => r.status === "maybe").length > 0 && (
                    <> · {myRsvps.filter(r => r.status === "maybe").length} need{myRsvps.filter(r => r.status === "maybe").length !== 1 ? "" : "s"} your reply</>
                  )}
                </>
              ) : (
                <>{deduplicatedEvents.length} upcoming</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Hearted events horizontal scroll */}
      {heartedEvents.length > 0 && (
        <div className="mb-6">
          <div className="px-6">
            <div className="mx-auto max-w-lg">
              {renderSectionHeader("Hearted", () => navigate("/hearted"))}
            </div>
          </div>
          <div className="px-6">
            <div className="mx-auto max-w-lg">
              <div
                ref={heartedScrollRef}
                className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {heartedEvents.map((event: any) => {
                  const eventDate = new Date(event.starts_at);
                  return (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="flex-shrink-0 w-40 rounded-2xl overflow-hidden shadow-sm transition-transform active:scale-[0.97]"
                      style={{ height: 200 }}
                    >
                      <div className="relative h-full w-full">
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" style={{ objectPosition: (event as any).cover_image_position || "50% 50%" }} />
                        ) : (
                          <div className="h-full w-full" style={{ background: getGradient(event.id) }} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                        {/* Heart icon */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(event.id); }}
                          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90"
                        >
                          <Heart className="h-3 w-3" fill="#D89B86" color="#D89B86" strokeWidth={1.5} />
                        </button>

                        {/* Bottom text */}
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="font-sans text-[8px] font-semibold uppercase tracking-[0.2em] text-white/80 mb-0.5">
                            {format(eventDate, "EEE, MMM d")}
                          </p>
                          <h4 className="font-serif text-sm font-normal leading-tight text-white line-clamp-2">
                            {event.title}
                          </h4>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Contextual banners ──────────────────────────────────────────────── */}
      {(() => {
        // Build banner list by priority, show at most 2
        const banners: React.ReactNode[] = [];

        // 1. Admin: pending membership requests
        if (isAdmin && pendingMemberCount > 0 && !dismissedBanners.has("admin-members")) {
          banners.push(
            <div key="admin-members" className="flex items-center gap-3 rounded-2xl border border-cream bg-paper px-4 py-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cream">
                <Users className="h-4 w-4 text-taupe" strokeWidth={1.5} />
              </div>
              <button
                onClick={() => navigate("/admin/members")}
                className="flex-1 min-w-0 text-left"
              >
                <p className="font-sans text-[13px] font-semibold text-espresso leading-snug">
                  {pendingMemberCount} member {pendingMemberCount === 1 ? "request" : "requests"} to review
                </p>
                <p className="font-sans text-[11px] text-taupe mt-0.5">
                  {pendingMemberCount === 1 ? "Someone wants" : "People want"} to join Sonder Circle
                </p>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate("/admin/members")}
                  className="rounded-full bg-espresso px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-background"
                >
                  Review
                </button>
                <button
                  onClick={() => dismissBanner("admin-members")}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-cream transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-taupe" strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        }

        // 2. Unpaid RSVPs (show first unpaid)
        if (unpaidRsvps.length > 0) {
          const first = unpaidRsvps[0] as any;
          const bannerKey = `unpaid-${first.event_id}`;
          if (!dismissedBanners.has(bannerKey)) {
            banners.push(
              <div key={bannerKey} className="flex items-center gap-3 rounded-2xl border border-blush/20 bg-blush/5 px-4 py-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blush/10">
                  <CreditCard className="h-4 w-4 text-blush" strokeWidth={1.5} />
                </div>
                <button
                  onClick={() => navigate(`/event/${first.event_id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-sans text-[13px] font-semibold text-espresso leading-snug">
                    Payment due for {first.events?.title}
                  </p>
                  <p className="font-sans text-[11px] text-taupe mt-0.5">
                    ${(first.events?.price_cents / 100).toFixed(0)} — tap to pay
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/event/${first.event_id}`)}
                    className="rounded-full bg-blush px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                  >
                    Pay
                  </button>
                  <button
                    onClick={() => dismissBanner(bannerKey)}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-blush/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-taupe" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          }
        }

        // 3. Pending event invites
        if (pendingInvites.length > 0) {
          const first = pendingInvites[0] as any;
          const bannerKey = `invite-${first.id}`;
          if (!dismissedBanners.has(bannerKey)) {
            const inviterFirst = first.inviter?.full_name?.split(" ")[0] ?? "Someone";
            banners.push(
              <div key={bannerKey} className="flex items-center gap-3 rounded-2xl border border-cream bg-paper px-4 py-3.5">
                {first.inviter?.avatar_url ? (
                  <img src={first.inviter.avatar_url} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blush/20 font-serif text-[13px] text-espresso">
                    {(first.inviter?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/event/${first.event_id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-sans text-[13px] font-semibold text-espresso leading-snug">
                    {inviterFirst} invited you
                    {pendingInvites.length > 1 ? ` (+${pendingInvites.length - 1} more)` : ""}
                  </p>
                  <p className="font-sans text-[11px] text-taupe mt-0.5 truncate">
                    {first.event?.title ?? "to an event"}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/event/${first.event_id}`)}
                    className="flex items-center gap-1 rounded-full bg-espresso px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-background"
                  >
                    View
                    <ChevronRight className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => {
                      dismissBanner(bannerKey);
                      // Also persist dismissal to DB so banner stays gone across sessions
                      supabase
                        .from("notifications" as any)
                        .update({ is_read: true, is_dismissed: true })
                        .eq("user_id", user!.id)
                        .eq("type", "event_invite")
                        .eq("related_event_id", first.event_id)
                        .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }));
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-cream transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-taupe" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          }
        }

        if (banners.length === 0) return null;

        const visible = banners.slice(0, 2);
        const hasMore = banners.length > 2;

        return (
          <div className="px-6 mb-2">
            <div className="mx-auto max-w-lg space-y-2.5">
              {visible}
              {hasMore && (
                <button
                  onClick={() => navigate("/notifications")}
                  className="w-full text-center font-sans text-[11px] text-taupe/70 underline underline-offset-2"
                >
                  View all notifications
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
                  {mode === "hosting" ? "You're not hosting any events" : mode === "going" ? "No upcoming events" : "Nothing coming up"}
                </h2>
                <p className="font-serif italic text-sm text-taupe">
                  {mode === "hosting" ? "Create your first gathering." : mode === "going" ? "RSVP to an event to see it here." : "Check back soon for new events."}
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

      <BottomNav />
    </div>
  );
};

export default Index;
