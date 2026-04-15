import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/lib/auth";
import { EventChat, useUnreadChatCount } from "@/components/EventChat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft,
  Home,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Check,
  HelpCircle,
  X,
  Bell,
  CircleDollarSign,
  CircleAlert,
  Send,
  ImagePlus,
  Camera,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Ban,
  Lock,
  UserCheck,
  Globe,
  UserPlus,
  Search,
  CalendarPlus,
  ExternalLink,
  Heart,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type TabKey = "about" | "guests" | "chat" | "updates";

const EventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updateBody, setUpdateBody] = useState("");
  const [updateImage, setUpdateImage] = useState<File | null>(null);
  const [updateImagePreview, setUpdateImagePreview] = useState<string | null>(null);
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const updateImageRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabKey>("about");
  const [showCheckout, setShowCheckout] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [showInviteMembers, setShowInviteMembers] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const { isFavorited, toggleFavorite } = useFavorites();

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

  const { data: rsvpRequests = [] } = useQuery({
    queryKey: ["rsvp_requests", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvp_requests")
        .select("*, profiles:user_id(full_name, avatar_url)")
        .eq("event_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

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

  const { data: photos = [] } = useQuery({
    queryKey: ["event_photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_photos")
        .select("*, profiles!event_photos_uploaded_by_fkey(full_name, avatar_url)")
        .eq("event_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const { data: eventInvites = [] } = useQuery({
    queryKey: ["event_invites", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_invites")
        .select("*")
        .eq("event_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["all_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && showInviteMembers,
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("event_invites").insert({
        event_id: id!,
        invited_user_id: memberId,
        invited_by: user!.id,
      });
      if (error) throw error;
      try {
        const member = allMembers.find((m: any) => m.id === memberId);
        if (member?.email && event) {
          const hostName = user?.user_metadata?.full_name || "The host";
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "event-invite",
              recipientEmail: member.email,
              idempotencyKey: `event-invite-${id}-${memberId}`,
              templateData: {
                eventTitle: event.title,
                eventDate: format(new Date(event.starts_at), "EEEE, MMMM d 'at' h:mm a"),
                hostName,
                eventUrl: `${window.location.origin}/event/${id}`,
              },
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send event invite email:", emailErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_invites", id] });
      toast({ title: "Invite sent!" });
    },
    onError: (err: any) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, photos]);

  const myRsvp = rsvps.find((r: any) => r.user_id === user?.id);
  const myRequest = rsvpRequests.find((r: any) => r.user_id === user?.id);
  const pendingRequests = rsvpRequests.filter((r: any) => r.status === "pending");
  const canChatEarly = event?.host_id === user?.id || myRsvp?.status === "going" || myRsvp?.status === "maybe";
  const unreadChatCount = useUnreadChatCount(id, user?.id, !!canChatEarly);
  const queryClient2 = useQueryClient();

  const handleCancelEvent = async () => {
    if (!user || !id || !event) return;
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-event", {
        body: { eventId: id, appUrl: window.location.origin },
      });
      if (error) throw error;
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Event cancelled", description: "All guests have been notified." });
    } catch (err: any) {
      toast({ title: "Failed to cancel event", description: err.message, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  const requestToJoinMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rsvp_requests").insert({
        event_id: id!,
        user_id: user!.id,
        message: requestMessage.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvp_requests", id] });
      setRequestMessage("");
      toast({ title: "Request sent!", description: "The host will review your request." });
    },
    onError: (err: any) => {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("approve_rsvp_request", {
        _request_id: requestId,
        _host_id: user!.id,
      });
      if (error) throw error;
      if (!data) throw new Error("Could not approve request");
      return requestId;
    },
    onSuccess: async (requestId) => {
      queryClient.invalidateQueries({ queryKey: ["rsvp_requests", id] });
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
      toast({ title: "Request approved" });
      if (event) {
        const req = rsvpRequests.find((r: any) => r.id === requestId);
        if (req) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", req.user_id)
            .maybeSingle();
          if (profileData?.email) {
            const hostName = (event.profiles as any)?.full_name || "The host";
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "join-request-approved",
                recipientEmail: profileData.email,
                idempotencyKey: `join-approved-${requestId}`,
                templateData: {
                  eventTitle: event.title,
                  eventDate: format(new Date(event.starts_at), "EEEE, MMMM d 'at' h:mm a"),
                  hostName,
                  eventUrl: `${window.location.origin}/event/${id}`,
                },
              },
            }).catch(() => {});
          }
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("rsvp_requests")
        .update({ status: "declined", decided_by: user!.id, decided_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      try {
        const request = pendingRequests?.find((r: any) => r.id === requestId);
        if (request?.user_id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", request.user_id)
            .single();
          if (profileData?.email) {
            const hostName = user?.user_metadata?.full_name || "The host";
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "join-request-declined",
                recipientEmail: profileData.email,
                idempotencyKey: `join-declined-${requestId}`,
                templateData: { eventTitle: event?.title, hostName },
              },
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send decline email:", emailErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvp_requests", id] });
      toast({ title: "Request declined" });
    },
    onError: (err: any) => {
      toast({ title: "Decline failed", description: err.message, variant: "destructive" });
    },
  });

  const handlePostUpdate = async () => {
    if (!updateBody.trim() || !user || !id) return;
    setIsPostingUpdate(true);
    try {
      let imageUrl: string | null = null;
      if (updateImage) {
        const ext = updateImage.name.split(".").pop();
        const path = `updates/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("event-images").upload(path, updateImage);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const { data: insertedUpdate, error } = await supabase.from("updates").insert({
        event_id: id,
        author_id: user.id,
        body: updateBody.trim(),
        image_url: imageUrl,
      }).select("id").single();
      if (error) throw error;
      setUpdateBody("");
      setUpdateImage(null);
      setUpdateImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ["updates", id] });
      toast({ title: "Update posted" });

      if (insertedUpdate && event) {
        const attendeeRsvps = rsvps.filter((r: any) => r.status === "going" || r.status === "maybe");
        const hostName = (event.profiles as any)?.full_name || "Your host";
        const updateText = updateBody.trim();
        const truncatedUpdate = updateText.length > 80 ? updateText.substring(0, 80) + "…" : updateText;
        for (const rsvp of attendeeRsvps) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email, phone, phone_verified")
            .eq("id", rsvp.user_id)
            .maybeSingle();
          if (profileData?.email) {
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "host-update",
                recipientEmail: profileData.email,
                idempotencyKey: `host-update-${insertedUpdate.id}-${rsvp.user_id}`,
                templateData: {
                  eventTitle: event.title,
                  hostName,
                  message: updateText,
                  eventUrl: `${window.location.origin}/event/${id}`,
                },
              },
            }).catch(() => {});
          }
          if (profileData?.phone && profileData?.phone_verified) {
            supabase.functions.invoke("send-sms", {
              body: {
                to: profileData.phone,
                message: `${hostName} posted an update for ${event.title}: ${truncatedUpdate} ${window.location.origin}/event/${id}`,
              },
            }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Failed to post update", description: err.message, variant: "destructive" });
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user || !id) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `photos/${id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("event-images").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
      const { error } = await supabase.from("event_photos").insert({
        event_id: id,
        uploaded_by: user.id,
        image_url: urlData.publicUrl,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["event_photos", id] });
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const rsvpMutation = useMutation({
    mutationFn: async (status: "going" | "maybe" | "declined") => {
      if (myRsvp) {
        if (status === myRsvp.status) {
          const { error } = await supabase.from("rsvps").delete().eq("id", myRsvp.id);
          if (error) throw error;
          return { action: "removed" as const, status };
        } else {
          const { error } = await supabase.from("rsvps").update({ status }).eq("id", myRsvp.id);
          if (error) throw error;
          return { action: "updated" as const, status };
        }
      } else {
        const rsvpId = crypto.randomUUID();
        const { error } = await supabase.from("rsvps").insert({
          id: rsvpId,
          event_id: id!,
          user_id: user!.id,
          status,
          paid: false,
        });
        if (error) throw error;
        return { action: "created" as const, status, rsvpId };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (result && result.action !== "removed" && user?.email && event) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "rsvp-confirmation",
            recipientEmail: user.email,
            idempotencyKey: `rsvp-confirm-${id}-${user.id}-${result.status}`,
            templateData: {
              eventTitle: event.title,
              eventDate: format(new Date(event.starts_at), "EEEE, MMMM d 'at' h:mm a"),
              eventLocation: event.location || undefined,
              status: result.status,
            },
          },
        }).catch(() => {});
      }
    },
    onError: (err: any) => {
      toast({ title: "RSVP failed", description: err.message, variant: "destructive" });
    },
  });

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        event_id: id,
        return_url: `${window.location.origin}/event/${id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if (error) throw error;
    if (!data?.clientSecret) throw new Error("Failed to create checkout session");
    return data.clientSecret;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;
  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="font-serif text-xl text-foreground">Event not found</p>
        <button onClick={() => navigate("/")} className="label-meta text-taupe hover:text-foreground transition-colors">
          ← Back to feed
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
  const spotsLeft = event.capacity != null ? event.capacity - goingRsvps.length : null;
  const isRequestToJoin = event.privacy === "request_to_join";
  const needsRequestToJoin = isRequestToJoin && !isHost && !myRsvp;
  const hasPendingRequest = myRequest?.status === "pending";
  const wasDeclined = myRequest?.status === "declined";
  const canChat = isHost || myRsvp?.status === "going" || myRsvp?.status === "maybe";

  const chatLabel = unreadChatCount > 0 ? `Chat · ${unreadChatCount}` : "Chat";
  const tabs: { key: TabKey; label: string; hasUnread?: boolean }[] = [
    { key: "about", label: "About" },
    { key: "guests", label: `Guests · ${goingRsvps.length}${isHost && pendingRequests.length > 0 ? ` · ${pendingRequests.length} pending` : ""}` },
    ...(canChat ? [{ key: "chat" as TabKey, label: chatLabel, hasUnread: unreadChatCount > 0 }] : []),
    { key: "updates", label: `Updates · ${updates.length}` },
  ];

  const hostInitials = (hostProfile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();

  const calendarBlock = (() => {
    if (myRsvp?.status !== "going") return null;
    const start = new Date(event.starts_at);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmtIcs = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const fmtGoogle = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
    const downloadIcs = () => {
      const ics = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sonder Circle//EN", "BEGIN:VEVENT",
        `DTSTART:${fmtIcs(start)}`, `DTEND:${fmtIcs(end)}`, `SUMMARY:${event.title}`,
        event.location ? `LOCATION:${event.location}` : "",
        event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n").substring(0, 500)}` : "",
        `URL:${window.location.href}`, "END:VEVENT", "END:VCALENDAR",
      ].filter(Boolean).join("\r\n");
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${fmtGoogle(start)}/${fmtGoogle(end)}${event.location ? `&location=${encodeURIComponent(event.location)}` : ""}${event.description ? `&details=${encodeURIComponent(event.description.substring(0, 500))}` : ""}`;
    return { downloadIcs, googleUrl };
  })();

  return (
    <div className="min-h-screen bg-background pb-44">
      {/* ── 1. HERO COVER ────────────────────────────────────────── */}
      <div className="relative h-72 w-full overflow-hidden">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "linear-gradient(135deg, #B5C2A3 0%, #7E8C6F 60%, #3A2A20 100%)" }}
          />
        )}
        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Top-left: Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
        >
          <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
        </button>

        {/* Top-right: Menu + Home */}
        <div className="absolute top-12 right-5 flex gap-2">
          {isHost && event.status !== "cancelled" && (
            <div className="relative">
              <button
                onClick={() => setShowHostMenu(!showHostMenu)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
              >
                <MoreHorizontal className="h-4 w-4 text-cocoa" strokeWidth={2} />
              </button>
              {showHostMenu && (
                <div className="absolute right-0 top-12 w-48 rounded-2xl border border-cream bg-paper shadow-lg overflow-hidden z-30">
                  <button
                    onClick={() => { setShowHostMenu(false); navigate(`/create?edit=${id}`); }}
                    className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-sans text-cocoa hover:bg-cream transition-colors"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    Edit event
                  </button>
                  <button
                    onClick={() => { setShowHostMenu(false); setShowCancelConfirm(true); }}
                    className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-sans text-destructive hover:bg-cream transition-colors"
                  >
                    <Ban className="h-4 w-4" strokeWidth={1.5} />
                    Cancel event
                  </button>
                </div>
              )}
            </div>
          )}
          {id && (
            <button
              onClick={() => toggleFavorite(id)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} fill={isFavorited(id) ? "#D89B86" : "none"} color={isFavorited(id) ? "#D89B86" : "#3A2A20"} />
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
          >
            <Home className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
        </div>

        {/* Hero pills (price + privacy) */}
        <div className="absolute top-12 left-20 flex gap-2">
          {event.status === "cancelled" && (
            <span className="rounded-full bg-destructive px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
              Cancelled
            </span>
          )}
          <span className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm">
            {isFree ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`}
          </span>
          <span className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm flex items-center gap-1">
            {event.privacy === "invite_only" ? <Lock className="h-3 w-3" /> : event.privacy === "request_to_join" ? <UserCheck className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {event.privacy === "invite_only" ? "Invite Only" : event.privacy === "request_to_join" ? "Request" : "Open"}
          </span>
        </div>

        {/* Hero title overlay at bottom */}
        <div className="absolute bottom-6 left-6 right-6">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70 mb-1.5">
            {format(new Date(event.starts_at), "EEEE · h:mm a")}
          </p>
          <h1 className="font-serif text-[36px] font-light leading-[1.1] tracking-tight text-white">
            {event.title}
          </h1>
        </div>
      </div>

      {/* ── 2. HOST ATTRIBUTION ROW ──────────────────────────────── */}
      <div className="mx-auto max-w-lg px-6 pt-6 pb-5 border-b border-cream">
        <div className="flex items-center gap-3">
          {hostProfile?.avatar_url ? (
            <img src={hostProfile.avatar_url} alt="" className="h-[42px] w-[42px] rounded-full object-cover" />
          ) : (
            <div className="h-[42px] w-[42px] rounded-full bg-blush/30 flex items-center justify-center font-serif text-sm text-espresso">
              {hostInitials}
            </div>
          )}
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
              Hosted By
            </p>
            <p className="font-serif text-[17px] text-espresso">
              {hostProfile?.full_name || "Host"}
            </p>
            {isHost && (
              <p className="font-serif text-[13px] italic text-taupe">You're hosting</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. METADATA ROW (3 columns) ──────────────────────────── */}
      <div className="mx-auto max-w-lg px-6 py-5 border-b border-cream">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <Calendar className="h-4 w-4 text-blush" strokeWidth={1.5} />
            <p className="font-sans text-xs font-semibold text-cocoa">
              {format(new Date(event.starts_at), "EEE, MMM d")}
            </p>
            <p className="font-sans text-[10.5px] text-taupe">
              {format(new Date(event.starts_at), "h:mm a")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blush" strokeWidth={1.5} />
            {event.location ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-xs font-semibold text-cocoa hover:underline underline-offset-2 line-clamp-1"
              >
                {event.location.split(",")[0]}
              </a>
            ) : (
              <p className="font-sans text-xs font-semibold text-cocoa">TBD</p>
            )}
            {event.location && (
              <p className="font-sans text-[10.5px] text-taupe line-clamp-1">
                {event.location.split(",").slice(1).join(",").trim() || "View map"}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Users className="h-4 w-4 text-blush" strokeWidth={1.5} />
            <p className="font-sans text-xs font-semibold text-cocoa">
              {goingRsvps.length} going
            </p>
            {spotsLeft !== null && (
              <p className="font-sans text-[10.5px] text-taupe">
                {spotsLeft} spots left
              </p>
            )}
          </div>
        </div>

        {/* Add to Calendar (only for going guests) */}
        {calendarBlock && (
          <div className="mt-4 flex justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream/80">
                  <CalendarPlus className="h-3.5 w-3.5 text-blush" strokeWidth={1.5} />
                  Add to Calendar
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1 rounded-xl" align="center">
                <button
                  onClick={calendarBlock.downloadIcs}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-sans text-cocoa transition-colors hover:bg-cream"
                >
                  Apple Calendar
                </button>
                <a
                  href={calendarBlock.googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-sans text-cocoa transition-colors hover:bg-cream"
                >
                  Google Calendar
                </a>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* ── 4. TABS (flat, editorial) ────────────────────────────── */}
      <div className="mx-auto max-w-lg px-6 mt-0">
        <div className="flex border-b border-cream">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative px-3 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors",
                tab === t.key
                  ? "text-espresso"
                  : "text-taupe hover:text-cocoa"
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cocoa" />
              )}
              {t.hasUnread && tab !== t.key && (
                <span className="absolute top-2 -right-0.5 h-1.5 w-1.5 rounded-full bg-blush" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. TAB CONTENT ───────────────────────────────────────── */}
      <div className="mx-auto max-w-lg px-6 mt-6">
        {tab === "about" && (
          <div className="space-y-6">
            {/* Description — editorial serif italic */}
            {event.description ? (
              <p className="font-serif italic text-[17px] leading-[1.55] text-cocoa whitespace-pre-wrap">
                {event.description}
              </p>
            ) : (
              <p className="font-serif italic text-[15px] text-taupe">
                No description yet.
              </p>
            )}

            {/* Photo gallery */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
                  Photos · {photos.length}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.slice(0, 9).map((photo: any, idx: number) => (
                    <div
                      key={photo.id}
                      className="relative rounded-xl overflow-hidden aspect-square cursor-pointer"
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
                      {idx === 8 && photos.length > 9 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-serif text-lg">+{photos.length - 9}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add photos link */}
            {(isHost || myRsvp) && (
              <div>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa transition-colors flex items-center gap-1.5"
                >
                  {photoUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {photoUploading ? "Uploading…" : "+ Add photos"}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {tab === "guests" && (
          <div className="space-y-6">
            {/* Host: pending requests */}
            {isHost && pendingRequests.length > 0 && (
              <div className="space-y-3">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-blush">
                  Pending Requests · {pendingRequests.length}
                </p>
                <div className="space-y-3">
                  {pendingRequests.map((req: any) => {
                    const profile = req.profiles;
                    const initials = (profile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                    return (
                      <div key={req.id} className="border-b border-cream pb-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso">
                              {initials}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-sm font-medium text-espresso">{profile?.full_name || "Member"}</p>
                            <p className="font-sans text-[10.5px] text-taupe">
                              {format(new Date(req.created_at), "MMM d · h:mm a")}
                            </p>
                          </div>
                        </div>
                        {req.message && (
                          <p className="font-serif text-sm italic text-cocoa">"{req.message}"</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveRequestMutation.mutate(req.id)}
                            disabled={approveRequestMutation.isPending || declineRequestMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-cocoa py-2.5 text-background transition-all hover:opacity-90 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" strokeWidth={1.5} />
                            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em]">Approve</span>
                          </button>
                          <button
                            onClick={() => declineRequestMutation.mutate(req.id)}
                            disabled={approveRequestMutation.isPending || declineRequestMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-cream bg-paper py-2.5 text-taupe transition-all hover:text-cocoa disabled:opacity-50"
                          >
                            <X className="h-4 w-4" strokeWidth={1.5} />
                            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em]">Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Host: Invite Members (invite_only) */}
            {isHost && event.privacy === "invite_only" && event.status === "active" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Invite Members</p>
                  <button
                    onClick={() => setShowInviteMembers(!showInviteMembers)}
                    className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream/80"
                  >
                    <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {showInviteMembers ? "Close" : "Add"}
                  </button>
                </div>

                {eventInvites.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventInvites.map((inv: any) => {
                      const member = allMembers.find((m: any) => m.id === inv.invited_user_id);
                      return (
                        <span key={inv.id} className="rounded-full bg-cream px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa">
                          {member?.full_name || "Member"} · {inv.status}
                        </span>
                      );
                    })}
                  </div>
                )}

                {showInviteMembers && (
                  <div className="border-b border-cream pb-5 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe" strokeWidth={1.5} />
                      <input
                        type="text"
                        placeholder="Search members…"
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        className="w-full rounded-full border border-cream bg-paper py-2.5 pl-9 pr-4 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {allMembers
                        .filter((m: any) => {
                          if (m.id === user?.id) return false;
                          if (eventInvites.some((inv: any) => inv.invited_user_id === m.id)) return false;
                          if (rsvps.some((r: any) => r.user_id === m.id)) return false;
                          if (!inviteSearch.trim()) return true;
                          return (m.full_name || "").toLowerCase().includes(inviteSearch.toLowerCase());
                        })
                        .map((m: any) => (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-cream transition-colors">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso">
                                {(m.full_name || "?")[0]}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-sans font-medium text-espresso truncate">{m.full_name || "Member"}</p>
                            </div>
                            <button
                              onClick={() => inviteMemberMutation.mutate(m.id)}
                              disabled={inviteMemberMutation.isPending}
                              className="rounded-full bg-cocoa px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              Invite
                            </button>
                          </div>
                        ))}
                      {allMembers.filter((m: any) => {
                        if (m.id === user?.id) return false;
                        if (eventInvites.some((inv: any) => inv.invited_user_id === m.id)) return false;
                        if (rsvps.some((r: any) => r.user_id === m.id)) return false;
                        if (!inviteSearch.trim()) return true;
                        return (m.full_name || "").toLowerCase().includes(inviteSearch.toLowerCase());
                      }).length === 0 && (
                        <p className="text-sm font-sans text-taupe text-center py-4">
                          {inviteSearch ? "No matching members found" : "All members have been invited"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment overview (host, paid events) */}
            {isHost && !isFree && (
              <div className="border-b border-cream pb-5 space-y-4">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Payment Overview</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-cream p-3 text-center">
                    <p className="font-serif text-2xl text-espresso">{goingRsvps.length}</p>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe mt-1">Going</p>
                  </div>
                  <div className="rounded-xl bg-cream p-3 text-center">
                    <p className="font-serif text-2xl text-sage">{goingRsvps.filter((r: any) => r.paid).length}</p>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe mt-1">Paid</p>
                  </div>
                  <div className="rounded-xl bg-cream p-3 text-center">
                    <p className="font-serif text-2xl text-destructive">{goingRsvps.filter((r: any) => !r.paid).length}</p>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe mt-1">Unpaid</p>
                  </div>
                </div>
                {goingRsvps.filter((r: any) => !r.paid).length > 0 && (
                  <button
                    onClick={async () => {
                      const unpaidGuests = goingRsvps.filter((r: any) => !r.paid);
                      for (const rsvp of unpaidGuests) {
                        const { data: profileData } = await supabase
                          .from("profiles")
                          .select("email, phone, phone_verified")
                          .eq("id", rsvp.user_id)
                          .maybeSingle();
                        if (profileData?.phone && profileData?.phone_verified) {
                          supabase.functions.invoke("send-sms", {
                            body: {
                              to: profileData.phone,
                              message: `Hey! Just a reminder to complete payment for ${event.title}: ${window.location.origin}/event/${id}`,
                            },
                          }).catch(() => {});
                        }
                      }
                      toast({
                        title: "Reminders sent",
                        description: `Payment reminders sent to ${unpaidGuests.length} unpaid guest(s).`,
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-full border border-cream bg-paper py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream"
                  >
                    <Bell className="h-4 w-4" strokeWidth={1.5} />
                    Send Payment Reminders
                  </button>
                )}
              </div>
            )}

            {/* Guest lists */}
            <GuestSection label={`Going · ${goingRsvps.length}`} rsvps={goingRsvps} showPaymentStatus={isHost && !isFree} />
            {maybeRsvps.length > 0 && <GuestSection label={`Maybe · ${maybeRsvps.length}`} rsvps={maybeRsvps} />}
            {declinedRsvps.length > 0 && <GuestSection label={`Can't go · ${declinedRsvps.length}`} rsvps={declinedRsvps} />}
            {rsvps.length === 0 && pendingRequests.length === 0 && (
              <p className="font-serif italic text-sm text-taupe text-center py-6">No RSVPs yet — be the first!</p>
            )}
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-5">
            {isHost && (
              <div className="border-b border-cream pb-5 space-y-3">
                <textarea
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Share an update with your guests…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-cream bg-paper px-4 py-3 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                />
                {updateImagePreview && (
                  <div className="relative">
                    <img src={updateImagePreview} alt="" className="rounded-xl w-full max-h-48 object-cover" />
                    <button
                      onClick={() => { setUpdateImage(null); setUpdateImagePreview(null); }}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm"
                    >
                      <X className="h-3.5 w-3.5 text-cocoa" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => updateImageRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
                  >
                    <ImagePlus className="h-4 w-4 text-taupe" strokeWidth={1.5} />
                  </button>
                  <input
                    ref={updateImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUpdateImage(file);
                        setUpdateImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <button
                    onClick={handlePostUpdate}
                    disabled={!updateBody.trim() || isPostingUpdate}
                    className="flex items-center gap-2 rounded-full bg-cocoa px-5 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-40"
                  >
                    {isPostingUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
                    Post
                  </button>
                </div>
              </div>
            )}
            {updates.length === 0 ? (
              <p className="font-serif italic text-sm text-taupe text-center py-8">
                No updates yet.
              </p>
            ) : (
              updates.map((update: any) => {
                const author = update.profiles;
                const authorInitials = (author?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                return (
                  <div key={update.id} className="border-b border-cream pb-5 space-y-3">
                    <div className="flex items-center gap-2.5">
                      {author?.avatar_url ? (
                        <img src={author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[10px] text-espresso">
                          {authorInitials}
                        </div>
                      )}
                      <span className="font-sans text-sm font-medium text-espresso">
                        {author?.full_name || "Member"}
                      </span>
                      {update.author_id === event.host_id && (
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-sage">Host</span>
                      )}
                      <span className="ml-auto font-sans text-[10.5px] text-taupe">
                        {format(new Date(update.created_at), "MMM d · h:mm a")}
                      </span>
                    </div>
                    <p className="font-sans text-sm text-cocoa whitespace-pre-wrap leading-relaxed">{update.body}</p>
                    {update.image_url && (
                      <img src={update.image_url} alt="" className="rounded-xl w-full object-cover max-h-64" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "chat" && (
          event.status === "cancelled" ? (
            <div className="text-center py-12 space-y-2">
              <Ban className="h-6 w-6 text-taupe mx-auto" strokeWidth={1.5} />
              <p className="font-sans text-sm text-taupe">This event was cancelled. The chat is now closed.</p>
            </div>
          ) : canChat ? (
            <EventChat
              eventId={id!}
              userId={user.id}
              isHost={isHost}
              eventTitle={event.title}
              onUnreadCountChange={(count) => {
                if (count === 0) {
                  queryClient2.invalidateQueries({ queryKey: ["chat_unread", id, user.id] });
                }
              }}
            />
          ) : (
            <div className="text-center py-12">
              <p className="font-serif italic text-sm text-taupe">RSVP to join the conversation.</p>
            </div>
          )
        )}
      </div>

      {/* ── 6. BOTTOM RSVP BAR ───────────────────────────────────── */}

      {/* Request-to-join flow */}
      {needsRequestToJoin && event.status !== "cancelled" && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-cream bg-background">
          <div className="px-6 py-3">
            <div className="mx-auto max-w-lg">
              {hasPendingRequest ? (
                <div className="flex items-center justify-center gap-2 rounded-full border border-blush/30 bg-blush/10 py-3.5">
                  <Clock className="h-4 w-4 text-blush" strokeWidth={1.5} />
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-blush">Request pending — waiting for host</span>
                </div>
              ) : wasDeclined ? (
                <div className="flex items-center justify-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 py-3.5">
                  <X className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-destructive">Your request was declined</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full rounded-full border border-cream bg-paper px-4 py-2.5 text-sm font-sans text-espresso placeholder:text-taupe focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
                  />
                  <button
                    onClick={() => requestToJoinMutation.mutate()}
                    disabled={requestToJoinMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-cocoa py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {requestToJoinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 text-background animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-background" strokeWidth={1.5} />
                    )}
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background">Request to Join</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Free events RSVP bar */}
      {isFree && event.status !== "cancelled" && !needsRequestToJoin && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-cream bg-background">
          <div className="px-6 py-3">
            <div className="mx-auto max-w-lg">
              {isHost ? (
                <div className="text-center space-y-1">
                  <p className="font-serif italic text-[12px] text-taupe">You're hosting this event</p>
                  <button
                    onClick={() => navigate(`/create?edit=${id}`)}
                    className="w-full rounded-full bg-cocoa py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90"
                  >
                    Manage Event
                  </button>
                </div>
              ) : myRsvp?.status === "going" ? (
                /* Guest confirmed */
                <div className="flex items-center justify-center gap-2 rounded-full bg-sage/20 py-3.5">
                  <Check className="h-4 w-4 text-sage" strokeWidth={2} />
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-sage">You're confirmed</span>
                </div>
              ) : (
                /* Guest not yet RSVP'd */
                <div className="flex gap-3">
                  <button
                    onClick={() => rsvpMutation.mutate("declined")}
                    disabled={rsvpMutation.isPending}
                    className={cn(
                      "w-[38%] rounded-full border border-cream bg-paper py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all hover:bg-cream disabled:opacity-50",
                      myRsvp?.status === "declined" ? "text-cocoa border-cocoa" : "text-taupe"
                    )}
                  >
                    Can't make it
                  </button>
                  <button
                    onClick={() => rsvpMutation.mutate("going")}
                    disabled={rsvpMutation.isPending}
                    className="flex-1 rounded-full bg-cocoa py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    I'm going
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paid events */}
      {!isFree && event.status !== "cancelled" && !needsRequestToJoin && (
        <>
          {showCheckout && !myRsvp?.paid && (
            <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
              <div className="mx-auto max-w-lg px-6 pt-12 pb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-xl text-espresso">Complete Payment</h2>
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-cream"
                  >
                    <X className="h-4 w-4 text-cocoa" strokeWidth={1.5} />
                  </button>
                </div>
                <PaymentTestModeBanner />
                <div className="mt-4 rounded-2xl overflow-hidden border border-cream">
                  <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              </div>
            </div>
          )}
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-cream bg-background">
            <div className="px-6 py-3">
              <div className="mx-auto max-w-lg">
                {isHost ? (
                  <div className="text-center space-y-1">
                    <p className="font-serif italic text-[12px] text-taupe">You're hosting this event</p>
                    <button
                      onClick={() => navigate(`/create?edit=${id}`)}
                      className="w-full rounded-full bg-cocoa py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90"
                    >
                      Manage Event
                    </button>
                  </div>
                ) : myRsvp?.paid ? (
                  <div className="flex items-center justify-center gap-2 rounded-full bg-sage/20 py-3.5">
                    <Check className="h-4 w-4 text-sage" strokeWidth={2} />
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-sage">You're confirmed · Paid</span>
                  </div>
                ) : myRsvp?.status === "going" && !myRsvp?.paid ? (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-blush py-3.5 transition-all hover:opacity-90"
                  >
                    <CreditCard className="h-4 w-4 text-white" strokeWidth={1.5} />
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                      Pay ${(event.price_cents / 100).toFixed(0)} to confirm
                    </span>
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => rsvpMutation.mutate("declined")}
                      disabled={rsvpMutation.isPending}
                      className="w-[38%] rounded-full border border-cream bg-paper py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                    >
                      Can't make it
                    </button>
                    <button
                      onClick={() => setShowCheckout(true)}
                      disabled={rsvpMutation.isPending}
                      className="flex-1 rounded-full bg-cocoa py-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {`RSVP · $${(event.price_cents / 100).toFixed(0)}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── LIGHTBOX ─────────────────────────────────────────────── */}
      {lightboxIndex !== null && photos && photos.length > 0 && (() => {
        const currentPhoto = photos[lightboxIndex];
        if (!currentPhoto) return null;
        const lightboxUrl = currentPhoto.image_url;
        const hasPrev = lightboxIndex > 0;
        const hasNext = lightboxIndex < photos.length - 1;
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxIndex(null)}
          >
            <div className="absolute top-12 right-5 flex gap-3">
              <a
                href={lightboxUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <Download className="h-5 w-5 text-white" strokeWidth={1.5} />
              </a>
              <button
                onClick={() => setLightboxIndex(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <X className="h-5 w-5 text-white" strokeWidth={1.5} />
              </button>
            </div>
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            )}
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-4 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>
        );
      })()}

      {/* ── CANCEL CONFIRM MODAL ─────────────────────────────────── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-3xl bg-paper p-6 space-y-4">
            <h2 className="font-serif text-xl text-espresso">Cancel {event.title}?</h2>
            <p className="font-sans text-sm text-taupe leading-relaxed">
              This will notify all guests and refund anyone who's paid. This can't be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="flex-1 rounded-full border border-cream bg-paper py-3 font-sans text-sm font-medium text-cocoa transition-colors hover:bg-cream"
              >
                Keep event
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={isCancelling}
                className="flex-1 rounded-full bg-destructive py-3 font-sans text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling…" : "Cancel event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Guest section sub-component ──────────────────────────────────────
const GuestSection = ({
  label,
  rsvps,
  showPaymentStatus = false,
}: {
  label: string;
  rsvps: any[];
  showPaymentStatus?: boolean;
}) => (
  <div className="space-y-3">
    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">{label}</p>
    <div className="space-y-0">
      {rsvps.map((rsvp: any) => {
        const profile = rsvp.profiles;
        const initials = (profile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
        return (
          <div key={rsvp.id} className="flex items-center gap-3 border-b border-cream py-3 last:border-b-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso">
                {initials}
              </div>
            )}
            <span className="font-sans text-sm text-espresso">{profile?.full_name || "Member"}</span>
            {showPaymentStatus && (
              <span className={cn(
                "ml-auto rounded-full px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em]",
                rsvp.paid ? "bg-sage/20 text-sage" : "bg-destructive/10 text-destructive"
              )}>
                {rsvp.paid ? "Paid" : "Unpaid"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default EventDetail;
