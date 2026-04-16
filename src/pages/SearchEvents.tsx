import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, Search, X, Calendar, Users, Share2, Heart, Lock, UserCheck, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/use-favorites";
import { Input } from "@/components/ui/input";

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

const SearchEvents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const { isFavorited, toggleFavorite } = useFavorites();

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // All upcoming, active events — RLS ensures user only sees what they're allowed to see
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["search-events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status), event_hosts(user_id, profiles!event_hosts_user_id_fkey(full_name, avatar_url))"
        )
        .gte("starts_at", new Date().toISOString())
        .or("status.eq.active,status.is.null")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // My RSVPs (to show RSVP status on cards)
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

  const myRsvpEventIds = useMemo(() => new Set(myRsvps.map((r) => r.event_id)), [myRsvps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event: any) => {
      const hostName = (event.profiles?.full_name || "").toLowerCase();
      const coHostNames = (event.event_hosts || [])
        .map((h: any) => (h.profiles?.full_name || "").toLowerCase())
        .join(" ");
      return (
        (event.title || "").toLowerCase().includes(q) ||
        (event.location || "").toLowerCase().includes(q) ||
        (event.description || "").toLowerCase().includes(q) ||
        hostName.includes(q) ||
        coHostNames.includes(q)
      );
    });
  }, [events, search]);

  const handleShare = async (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
    }
  };

  const renderCard = (event: any) => {
    const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
    const hostProfile = event.profiles;
    const coHosts: any[] = event.event_hosts || [];
    const allHosts = coHosts.length > 0
      ? coHosts.map((h: any) => h.profiles).filter(Boolean)
      : [hostProfile].filter(Boolean);
    const hostFirstNames = allHosts.map((h: any) => (h?.full_name || "Host").split(" ")[0]);
    const hostDisplayName =
      hostFirstNames.length === 0 ? "Host"
      : hostFirstNames.length === 1 ? allHosts[0]?.full_name || "Host"
      : hostFirstNames.length === 2 ? `${hostFirstNames[0]} & ${hostFirstNames[1]}`
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
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="h-full w-full object-cover"
              style={{ objectPosition: (event as any).cover_image_position || "50% 50%" }}
            />
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
                <span className="font-sans text-[11px] text-taupe truncate max-w-[180px]">
                  {event.location.split(",")[0]}
                </span>
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Sticky header with search bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-cream">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-cream transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>

          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events by name, host, or location..."
              className="pl-10 pr-10 rounded-2xl border-cream bg-paper h-11 font-sans text-sm text-espresso placeholder:text-taupe focus-visible:ring-cocoa"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-taupe hover:text-espresso transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-lg px-6 pt-5 space-y-4">
        {isLoading ? (
          <div className="space-y-4 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-paper border border-cream h-64" />
            ))}
          </div>
        ) : !search.trim() ? (
          /* Empty state — no query typed yet */
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream mb-5">
              <Search className="h-7 w-7 text-taupe" strokeWidth={1.5} />
            </div>
            <p className="font-serif italic text-[15px] text-taupe">
              Search across all events available to you
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* No results */
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream mb-5">
              <Calendar className="h-7 w-7 text-taupe/50" strokeWidth={1.5} />
            </div>
            <h2 className="font-serif text-xl text-espresso mb-1">No events found</h2>
            <p className="font-serif italic text-sm text-taupe">
              Try searching by a different name, host, or location
            </p>
          </div>
        ) : (
          /* Results */
          <>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            {filtered.map((event: any) => (
              <div key={event.id}>{renderCard(event)}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchEvents;
