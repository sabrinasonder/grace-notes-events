import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Search,
  X,
  MoreVertical,
  Bell,
  Trash2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BottomNav } from "@/components/BottomNav";

const Archive = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ id: string; title: string } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Check if current user is admin
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("has_role", {
        user_id: user!.id,
        role: "admin",
      });
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch past events the user hosted or RSVP'd to
  const { data: pastEvents = [], isLoading } = useQuery({
    queryKey: ["archive-events", user?.id],
    queryFn: async () => {
      const { data: myRsvps } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("user_id", user!.id)
        .in("status", ["going", "maybe"]);
      const rsvpEventIds = myRsvps?.map((r) => r.event_id) || [];

      const { data: allPast, error } = await supabase
        .from("events")
        .select(
          "*, profiles!events_host_id_fkey(full_name, avatar_url), rsvps(id, status)"
        )
        .or("starts_at.lt." + new Date().toISOString() + ",status.eq.cancelled")
        .order("starts_at", { ascending: false });

      if (error) throw error;

      return (allPast || []).filter(
        (e: any) => e.host_id === user!.id || rsvpEventIds.includes(e.id)
      );
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return pastEvents;
    const q = search.toLowerCase();
    return pastEvents.filter(
      (e: any) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [pastEvents, search]);

  // Notify members to save photos
  const notifyPhotosMutation = useMutation({
    mutationFn: async (event: any) => {
      // Save notification timestamp
      const { error } = await (supabase as any)
        .from("events")
        .update({ photo_save_notified_at: new Date().toISOString() })
        .eq("id", event.id);
      if (error) throw error;

      // Queue in-app notification to all going attendees
      const goingRsvps = (event.rsvps || []).filter((r: any) => r.status === "going");
      if (goingRsvps.length > 0) {
        const notifications = goingRsvps.map((r: any) => ({
          user_id: r.user_id ?? r.id, // rsvps.user_id
          event_id: event.id,
          message: `Photos from "${event.title}" will be available for 7 more days. Save any you'd like to keep!`,
          type: "photo_reminder",
        }));
        // Best-effort insert; ignore if table doesn't exist yet
        await (supabase as any).from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      toast({ title: "Members notified!", description: "They have 7 days to save photos." });
      qc.invalidateQueries({ queryKey: ["archive-events", user?.id] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
    },
  });

  // Delete event
  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await (supabase as any)
        .from("events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Event deleted" });
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["archive-events", user?.id] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Send message to attendees
  const handleSendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      // Save to event_updates / notifications — best effort
      await (supabase as any).from("event_updates").insert({
        event_id: messageTarget.id,
        body: messageText.trim(),
        created_by: user!.id,
      });

      toast({ title: "Message sent to attendees" });
      setMessageTarget(null);
      setMessageText("");
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const getDeleteEligibility = (event: any): { canDelete: boolean; reason?: string } => {
    if (!event.photo_save_notified_at) {
      return { canDelete: false, reason: "Notify members about photos first." };
    }
    const daysSince = differenceInDays(new Date(), new Date(event.photo_save_notified_at));
    if (daysSince < 7) {
      const deleteDate = format(
        new Date(new Date(event.photo_save_notified_at).getTime() + 7 * 24 * 60 * 60 * 1000),
        "MMM d"
      );
      return { canDelete: false, reason: `Deletable after ${deleteDate} (${7 - daysSince} days remaining).` };
    }
    return { canDelete: true };
  };

  if (loading) return null;
  if (!user) return <Navigate to="/join" replace />;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-lg flex items-center px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">Archive</h1>
          <div className="h-10 w-10" />
        </div>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-lg px-6 pt-5 pb-3">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search events by name, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-2xl border-cream bg-paper h-11 font-sans text-sm text-espresso placeholder:text-taupe focus-visible:ring-cocoa"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-taupe hover:text-espresso"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="mx-auto max-w-lg px-6 space-y-3">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-paper border border-cream h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-cream bg-paper px-6 py-12 text-center">
            <Calendar className="mx-auto mb-3 h-8 w-8 text-taupe/30" strokeWidth={1.5} />
            <p className="font-serif italic text-[15px] text-taupe">
              {search ? "No events match that search." : "No past events yet."}
            </p>
          </div>
        ) : (
          filtered.map((event: any) => {
            const goingCount = event.rsvps?.filter((r: any) => r.status === "going").length || 0;
            const isCancelled = event.status === "cancelled";
            const isHosted = event.host_id === user.id;
            const eligibility = isAdmin ? getDeleteEligibility(event) : null;

            return (
              <div
                key={event.id}
                className={`relative rounded-2xl border border-cream bg-paper overflow-hidden transition-opacity ${isCancelled ? "opacity-60" : ""}`}
              >
                {/* Clickable card area */}
                <button
                  onClick={() => navigate(`/event/${event.id}`)}
                  className="flex w-full text-left"
                >
                  {/* Thumbnail */}
                  <div className="h-24 w-24 shrink-0 overflow-hidden bg-cream">
                    {event.cover_image_url ? (
                      <img
                        src={event.cover_image_url}
                        alt={event.title}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: (event as any).cover_image_position || "50% 50%" }}
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          background:
                            "linear-gradient(135deg, #D89B86 0%, #B97A66 60%, #3A2A20 100%)",
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    {/* Date + badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-taupe">
                        {format(new Date(event.starts_at), "MMM d, yyyy").toUpperCase()}
                      </span>
                      {isCancelled && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-destructive">
                          Cancelled
                        </span>
                      )}
                      {isHosted && (
                        <span className="rounded-full bg-blush/20 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-cocoa">
                          Hosted
                        </span>
                      )}
                    </div>

                    <p className="font-serif text-[15px] text-espresso leading-snug line-clamp-1 mb-1.5">
                      {event.title}
                    </p>

                    <div className="flex items-center gap-3 text-taupe">
                      {event.location && (
                        <div className="flex items-center gap-1 min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                          <span className="font-sans text-[11px] truncate max-w-[110px]">
                            {event.location.split(",")[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                        <span className="font-sans text-[11px]">{goingCount}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Admin 3-dot menu */}
                {isAdmin && (
                  <div className="absolute top-3 right-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-taupe transition-colors hover:bg-cream"
                        >
                          <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        {/* Notify photos */}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (event.photo_save_notified_at) {
                              const days = differenceInDays(
                                new Date(),
                                new Date(event.photo_save_notified_at)
                              );
                              toast({
                                title: "Already notified",
                                description: `Members were notified ${days} day${days !== 1 ? "s" : ""} ago.`,
                              });
                            } else {
                              notifyPhotosMutation.mutate(event);
                            }
                          }}
                          className="gap-2"
                        >
                          <Bell className="h-3.5 w-3.5 text-taupe" strokeWidth={1.5} />
                          <span>
                            {event.photo_save_notified_at
                              ? `Photos notified ${differenceInDays(new Date(), new Date(event.photo_save_notified_at))}d ago`
                              : "Notify members to save photos"}
                          </span>
                        </DropdownMenuItem>

                        {/* Send message */}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setMessageTarget({ id: event.id, title: event.title });
                          }}
                          className="gap-2"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-taupe" strokeWidth={1.5} />
                          <span>Send message to attendees</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Delete */}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!eligibility?.canDelete) {
                              toast({
                                title: "Cannot delete yet",
                                description: eligibility?.reason,
                              });
                            } else {
                              setDeleteConfirm({ id: event.id, title: event.title });
                            }
                          }}
                          className={`gap-2 ${eligibility?.canDelete ? "text-destructive focus:text-destructive" : "text-taupe/50"}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Delete event</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirmation overlay */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm px-4 pb-6">
          <div className="w-full max-w-lg rounded-3xl bg-background p-6 space-y-4">
            <h2 className="font-serif text-xl text-espresso">Delete event?</h2>
            <p className="font-sans text-sm text-taupe leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="text-espresso font-semibold">"{deleteConfirm.title}"</span>?
              All photos and chat history will be removed. This can't be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full border border-cream py-3 font-sans text-sm font-semibold text-espresso transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-full bg-destructive py-3 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  "Delete permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send message overlay */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm px-4 pb-6">
          <div className="w-full max-w-lg rounded-3xl bg-background p-6 space-y-4">
            <h2 className="font-serif text-xl text-espresso">Message attendees</h2>
            <p className="font-sans text-[12px] text-taupe">{messageTarget.title}</p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Write your message…"
              rows={4}
              className="w-full resize-none rounded-xl border border-cream bg-paper px-4 py-3 font-sans text-sm text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setMessageTarget(null); setMessageText(""); }}
                className="flex-1 rounded-full border border-cream py-3 font-sans text-sm font-semibold text-espresso transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                className="flex-1 rounded-full bg-cocoa py-3 font-sans text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {sendingMessage ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Archive;
