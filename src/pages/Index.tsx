import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format } from "date-fns";
import { Plus, Calendar, MapPin, Users, Archive } from "lucide-react";

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
        .order("starts_at", { ascending: true });

      if (filter === "hosting") {
        query = query.eq("host_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (filter === "attending") {
        // Filter client-side for events user has RSVP'd going/maybe
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
        <div className="animate-pulse font-display text-2xl text-foreground">
          Sonder Circle
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All Events" },
    { key: "hosting", label: "Hosting" },
    { key: "attending", label: "Attending" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Account bar — top */}
      <div className="sticky top-0 left-0 right-0 border-b border-border bg-background/80 backdrop-blur-lg z-20">
        <div className="mx-auto flex max-w-lg items-center justify-center px-5 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/archive")}
              className="pill-tag border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              Archive
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="pill-tag border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </button>
            <button
              onClick={signOut}
              className="pill-tag border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="px-5 pt-8 pb-6">
        <div className="mx-auto max-w-lg space-y-1">
          <p className="label-meta text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl text-foreground">
            Sonder Circle
          </h1>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-5 pb-6">
        <div className="mx-auto flex max-w-lg gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`pill-tag transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event cards */}
      <div className="px-5">
        <div className="mx-auto max-w-lg space-y-5">
          {eventsLoading ? (
            <div className="space-y-5">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-3xl bg-card h-72"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Calendar className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl text-foreground">
                  No upcoming events
                </h2>
                <p className="text-sm text-muted-foreground">
                  {filter === "all"
                    ? "Be the first to create a gathering."
                    : filter === "hosting"
                    ? "You haven't created any events yet."
                    : "You haven't RSVP'd to any events yet."}
                </p>
              </div>
            </div>
          ) : (
            events.map((event: any) => {
              const goingCount =
                event.rsvps?.filter(
                  (r: any) => r.status === "going"
                ).length || 0;
              const hostProfile = event.profiles;

              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/event/${event.id}`)}
                  className="w-full text-left rounded-3xl border border-border bg-card overflow-hidden transition-transform active:scale-[0.98]"
                >
                  {/* Cover image */}
                  {event.cover_image_url ? (
                    <div className="h-44 w-full overflow-hidden">
                      <img
                        src={event.cover_image_url}
                        alt={event.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-secondary flex items-center justify-center">
                      <Calendar
                        className="h-10 w-10 text-muted-foreground/40"
                        strokeWidth={1}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5 space-y-3">
                    {/* Date pill + price */}
                    <div className="flex items-center justify-between">
                      <span className="pill-tag bg-secondary text-foreground">
                        {format(new Date(event.starts_at), "MMM d · h:mm a")}
                      </span>
                      <span className="pill-tag border border-border text-muted-foreground">
                        {event.price_cents > 0
                          ? `$${(event.price_cents / 100).toFixed(0)}`
                          : "Free"}
                      </span>
                    </div>

                    <h3 className="font-display text-xl text-foreground leading-tight">
                      {event.title}
                    </h3>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {/* Host */}
                      <div className="flex items-center gap-1.5">
                        {hostProfile?.avatar_url ? (
                          <img
                            src={hostProfile.avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-accent/30 flex items-center justify-center text-[9px] font-semibold text-foreground">
                            {(hostProfile?.full_name || "?")[0]}
                          </div>
                        )}
                        <span>{hostProfile?.full_name || "Host"}</span>
                      </div>

                      {/* Location */}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span className="truncate max-w-[120px]">
                            {event.location}
                          </span>
                        </div>
                      )}

                      {/* Going count */}
                      <div className="flex items-center gap-1 ml-auto">
                        <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>{goingCount} going</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* FAB — Create event */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={() => navigate("/create")}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          <span className="label-meta text-primary-foreground">
            Create Event
          </span>
        </button>
      </div>

    </div>
  );
};

export default Index;
