import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Search,
  Camera,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const Archive = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Fetch past events the user hosted or RSVP'd to
  const { data: pastEvents = [], isLoading } = useQuery({
    queryKey: ["archive-events", user?.id],
    queryFn: async () => {
      // Get events user RSVP'd to (going/maybe)
      const { data: myRsvps } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("user_id", user!.id)
        .in("status", ["going", "maybe"]);

      const rsvpEventIds = myRsvps?.map((r) => r.event_id) || [];

      // Get all past events (completed or cancelled)
      const { data: allPast, error } = await supabase
        .from("events")
        .select(
          "*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status)"
        )
        .or("starts_at.lt." + new Date().toISOString() + ",status.eq.cancelled")
        .order("starts_at", { ascending: false });

      if (error) throw error;

      // Filter to events user hosted OR RSVP'd to
      return (allPast || []).filter(
        (e: any) => e.host_id === user!.id || rsvpEventIds.includes(e.id)
      );
    },
    enabled: !!user,
  });

  // Fetch photo counts per event
  const eventIds = pastEvents.map((e: any) => e.id);
  const { data: photoCounts = {} } = useQuery({
    queryKey: ["archive-photo-counts", eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return {};
      const { data, error } = await supabase
        .from("event_photos")
        .select("event_id")
        .in("event_id", eventIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        counts[p.event_id] = (counts[p.event_id] || 0) + 1;
      });
      return counts;
    },
    enabled: eventIds.length > 0,
  });

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return pastEvents;
    const q = search.toLowerCase();
    return pastEvents.filter(
      (e: any) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [pastEvents, search]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-display text-2xl text-foreground">
          Sonder Circle
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="font-display text-3xl text-foreground">
            Past Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse events you've attended and download photos.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-5 pb-5">
        <div className="mx-auto max-w-lg relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Input
            placeholder="Search events by name, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-2xl border-border bg-card h-11"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="px-5">
        <div className="mx-auto max-w-lg space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-3xl bg-card h-28" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Calendar className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl text-foreground">
                  {search ? "No events found" : "No past events yet"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Try adjusting your search."
                    : "Events you attend will appear here after they end."}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((event: any) => {
              const goingCount =
                event.rsvps?.filter((r: any) => r.status === "going").length || 0;
              const hostProfile = event.profiles;
              const photoCount = (photoCounts as Record<string, number>)[event.id] || 0;

              const isCancelled = event.status === 'cancelled';

              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/event/${event.id}`)}
                  className={`w-full text-left rounded-3xl border border-border bg-card overflow-hidden transition-transform active:scale-[0.98] ${isCancelled ? 'opacity-60' : ''}`}
                >
                  <div className="flex">
                    {/* Cover thumbnail */}
                    {event.cover_image_url ? (
                      <div className="h-28 w-28 flex-shrink-0 overflow-hidden">
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-28 w-28 flex-shrink-0 bg-secondary flex items-center justify-center">
                        <Calendar className="h-8 w-8 text-muted-foreground/40" strokeWidth={1} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 p-4 space-y-1.5 min-w-0">
                      <span className="pill-tag bg-secondary text-foreground text-[10px]">
                        {format(new Date(event.starts_at), "MMM d, yyyy")}
                      </span>
                      <h3 className="font-display text-base text-foreground leading-tight truncate">
                        {event.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {event.location && (
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                            <span className="truncate max-w-[100px]">{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" strokeWidth={1.5} />
                          <span>{goingCount}</span>
                        </div>
                        {photoCount > 0 && (
                          <div className="flex items-center gap-1 text-accent">
                            <Camera className="h-3 w-3" strokeWidth={1.5} />
                            <span>{photoCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Archive;
