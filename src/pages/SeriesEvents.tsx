/**
 * /series/:parentId — All instances of a recurring event series.
 */
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, isPast } from "date-fns";
import { ArrowLeft, Repeat } from "lucide-react";
import { describeStoredRecurrence } from "@/lib/recurrence";
import { BottomNav } from "@/components/BottomNav";

const SeriesEvents = () => {
  const { parentId } = useParams<{ parentId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["series_events", parentId],
    queryFn: async () => {
      // Fetch the parent + all instances
      const [{ data: parent }, { data: instances }] = await Promise.all([
        supabase
          .from("events")
          .select("*, profiles!events_host_id_fkey(full_name)")
          .eq("id", parentId!)
          .maybeSingle(),
        supabase
          .from("events")
          .select("*, profiles!events_host_id_fkey(full_name)")
          .eq("parent_event_id", parentId!)
          .order("starts_at", { ascending: true }),
      ]);
      const all = [
        ...(parent ? [parent] : []),
        ...(instances ?? []),
      ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      return all;
    },
    enabled: !!parentId && !!user,
  });

  if (loading) return null;
  if (!user) return <Navigate to="/join" replace />;

  const parentEvent = events.find((e: any) => !e.parent_event_id);
  const recurrenceLabel = parentEvent
    ? describeStoredRecurrence(
        (parentEvent as any).recurrence_type,
        (parentEvent as any).recurrence_rule
      )
    : "";

  const upcoming = events.filter((e: any) => !isPast(new Date(e.starts_at)));
  const past = events.filter((e: any) => isPast(new Date(e.starts_at)));

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg text-espresso truncate">
              {parentEvent?.title ?? "Event Series"}
            </h1>
            {recurrenceLabel && (
              <div className="flex items-center gap-1.5">
                <Repeat className="h-3 w-3 text-taupe shrink-0" strokeWidth={1.5} />
                <p className="font-sans text-[11px] text-taupe">{recurrenceLabel}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6 pt-6 space-y-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-16 rounded-2xl bg-cream" />
            ))}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-taupe">
                  Upcoming · {upcoming.length}
                </p>
                {upcoming.map((e: any) => (
                  <EventRow key={e.id} event={e} navigate={navigate} />
                ))}
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-taupe">
                  Past · {past.length}
                </p>
                {past.map((e: any) => (
                  <EventRow key={e.id} event={e} navigate={navigate} />
                ))}
              </section>
            )}

            {events.length === 0 && (
              <div className="text-center py-16">
                <p className="font-serif text-xl text-espresso">No events found</p>
                <p className="font-serif italic text-sm text-taupe mt-2">
                  This series may have been removed.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

const EventRow = ({ event, navigate }: { event: any; navigate: (path: string) => void }) => {
  const eventDate = new Date(event.starts_at);
  const past = isPast(eventDate);
  const cancelled = event.status === "cancelled";

  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className="flex w-full items-center gap-4 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream/40"
    >
      {/* Date block */}
      <div className="flex flex-col items-center justify-center w-11 shrink-0">
        <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-taupe">
          {format(eventDate, "MMM")}
        </span>
        <span className="font-serif text-2xl leading-tight text-espresso">
          {format(eventDate, "d")}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-semibold text-espresso truncate">{event.title}</p>
        <p className="font-sans text-[12px] text-taupe">
          {format(eventDate, "EEEE · h:mm a")}
        </p>
      </div>

      {/* Status badge */}
      {cancelled ? (
        <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-destructive">
          Cancelled
        </span>
      ) : past ? (
        <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-taupe">
          Past
        </span>
      ) : null}
    </button>
  );
};

export default SeriesEvents;
