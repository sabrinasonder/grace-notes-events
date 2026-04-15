import { useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Check,
  HelpCircle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type TabKey = "about" | "guests" | "updates";

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("about");

  // Fetch event
  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // Fetch RSVPs with profiles
  const { data: rsvps = [] } = useQuery({
    queryKey: ["rsvps", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*, profiles!rsvps_user_id_fkey(full_name, avatar_url)")
        .eq("event_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // Fetch updates
  const { data: updates = [] } = useQuery({
    queryKey: ["updates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("updates")
        .select("*, profiles!updates_author_id_fkey(full_name, avatar_url)")
        .eq("event_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  // Current user's RSVP
  const myRsvp = rsvps.find((r: any) => r.user_id === user?.id);

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async (status: "going" | "maybe" | "declined") => {
      if (myRsvp) {
        if (status === myRsvp.status) {
          // Un-RSVP
          const { error } = await supabase
            .from("rsvps")
            .delete()
            .eq("id", myRsvp.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("rsvps")
            .update({ status })
            .eq("id", myRsvp.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("rsvps").insert({
          event_id: id!,
          user_id: user!.id,
          status,
          paid: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) => {
      toast({
        title: "RSVP failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-display text-2xl text-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;
  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="font-display text-xl text-foreground">Event not found</p>
        <button
          onClick={() => navigate("/")}
          className="pill-tag border border-border text-muted-foreground"
        >
          Back to feed
        </button>
      </div>
    );
  }

  const hostProfile = event.profiles as any;
  const isHost = event.host_id === user.id;
  const isFree = event.price_cents === 0;
  const goingRsvps = rsvps.filter((r: any) => r.status === "going");
  const maybeRsvps = rsvps.filter((r: any) => r.status === "maybe");
  const declinedRsvps = rsvps.filter((r: any) => r.status === "declined");
  const spotsLeft =
    event.capacity != null ? event.capacity - goingRsvps.length : null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "about", label: "About" },
    { key: "guests", label: `Guests (${goingRsvps.length})` },
    { key: "updates", label: `Updates (${updates.length})` },
  ];

  const rsvpButtons: {
    status: "going" | "maybe" | "declined";
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      status: "going",
      label: "Going",
      icon: <Check className="h-4 w-4" strokeWidth={1.5} />,
    },
    {
      status: "maybe",
      label: "Maybe",
      icon: <HelpCircle className="h-4 w-4" strokeWidth={1.5} />,
    },
    {
      status: "declined",
      label: "Can't go",
      icon: <X className="h-4 w-4" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Cover image */}
      {event.cover_image_url ? (
        <div className="relative h-56 w-full">
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-12 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <div className="relative h-36 w-full bg-secondary flex items-center justify-center">
          <Calendar
            className="h-12 w-12 text-muted-foreground/30"
            strokeWidth={1}
          />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-12 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Event header */}
      <div className="mx-auto max-w-lg px-5 -mt-6 relative z-10">
        <div className="space-y-4">
          {/* Price pill */}
          <div className="flex items-center gap-2">
            <span className="pill-tag bg-primary text-primary-foreground">
              {isFree ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`}
            </span>
            {!isFree && (
              <span className="pill-tag border border-border text-muted-foreground">
                Payment required
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl text-foreground leading-tight">
            {event.title}
          </h1>

          {/* Meta details */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" strokeWidth={1.5} />
              <span>
                {format(new Date(event.starts_at), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" strokeWidth={1.5} />
              <span>{format(new Date(event.starts_at), "h:mm a")}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" strokeWidth={1.5} />
                <span>{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" strokeWidth={1.5} />
              <span>
                {goingRsvps.length} going
                {event.capacity != null && ` · ${spotsLeft} spots left`}
              </span>
            </div>
          </div>

          {/* Host row */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            {hostProfile?.avatar_url ? (
              <img
                src={hostProfile.avatar_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-accent/30 flex items-center justify-center text-sm font-semibold text-foreground">
                {(hostProfile?.full_name || "?")[0]}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {hostProfile?.full_name || "Host"}
              </p>
              <p className="label-meta text-muted-foreground">Organizer</p>
            </div>
            {isHost && (
              <span className="ml-auto pill-tag bg-sage text-sage-foreground">
                You
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-lg px-5 mt-6">
        <div className="flex gap-1 rounded-2xl bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-center transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="label-meta">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-lg px-5 mt-5">
        {tab === "about" && (
          <div className="space-y-4">
            {event.description ? (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description provided.
              </p>
            )}
          </div>
        )}

        {tab === "guests" && (
          <div className="space-y-6">
            {/* Going */}
            <GuestSection
              label={`Going (${goingRsvps.length})`}
              rsvps={goingRsvps}
            />
            {/* Maybe */}
            {maybeRsvps.length > 0 && (
              <GuestSection
                label={`Maybe (${maybeRsvps.length})`}
                rsvps={maybeRsvps}
              />
            )}
            {/* Declined */}
            {declinedRsvps.length > 0 && (
              <GuestSection
                label={`Can't go (${declinedRsvps.length})`}
                rsvps={declinedRsvps}
              />
            )}
            {rsvps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No RSVPs yet — be the first!
              </p>
            )}
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-4">
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No updates yet.
              </p>
            ) : (
              updates.map((update: any) => {
                const author = update.profiles;
                return (
                  <div
                    key={update.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2.5">
                      {author?.avatar_url ? (
                        <img
                          src={author.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-accent/30 flex items-center justify-center text-xs font-semibold text-foreground">
                          {(author?.full_name || "?")[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {author?.full_name || "Host"}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {format(
                          new Date(update.created_at),
                          "MMM d · h:mm a"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {update.body}
                    </p>
                    {update.image_url && (
                      <img
                        src={update.image_url}
                        alt=""
                        className="rounded-xl w-full object-cover max-h-64"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* RSVP bar — only for free events and non-hosts */}
      {isFree && !isHost && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
          <div className="mx-auto max-w-lg px-5 py-4">
            <div className="flex gap-2">
              {rsvpButtons.map((btn) => {
                const isActive = myRsvp?.status === btn.status;
                return (
                  <button
                    key={btn.status}
                    onClick={() => rsvpMutation.mutate(btn.status)}
                    disabled={rsvpMutation.isPending}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-full py-3 transition-all",
                      isActive
                        ? btn.status === "going"
                          ? "bg-primary text-primary-foreground"
                          : btn.status === "maybe"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-foreground"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {btn.icon}
                    <span className="label-meta">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* For paid events show a placeholder message */}
      {!isFree && !isHost && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
          <div className="mx-auto max-w-lg px-5 py-4">
            <div className="flex items-center justify-center gap-2 rounded-full bg-card border border-border py-3">
              <DollarSign
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={1.5}
              />
              <span className="label-meta text-muted-foreground">
                Payment coming soon
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Host sees a subtle label */}
      {isHost && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
          <div className="mx-auto max-w-lg px-5 py-4 text-center">
            <span className="label-meta text-muted-foreground">
              You're hosting this event
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Guest section sub-component
const GuestSection = ({
  label,
  rsvps,
}: {
  label: string;
  rsvps: any[];
}) => (
  <div className="space-y-3">
    <h3 className="label-meta text-muted-foreground">{label}</h3>
    <div className="space-y-2">
      {rsvps.map((rsvp: any) => {
        const profile = rsvp.profiles;
        return (
          <div
            key={rsvp.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-accent/30 flex items-center justify-center text-sm font-semibold text-foreground">
                {(profile?.full_name || "?")[0]}
              </div>
            )}
            <span className="text-sm text-foreground">
              {profile?.full_name || "Member"}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

export default EventDetail;
