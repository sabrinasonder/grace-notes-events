import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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

  // Fetch RSVP requests (for host view + user's own request)
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

  // Fetch event photos
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

  // Keyboard navigation for lightbox
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

  // Cancel event handler (host only)
  const handleCancelEvent = async () => {
    if (!user || !id || !event) return;
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-event", {
        body: {
          eventId: id,
          appUrl: window.location.origin,
        },
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

  // Request to join mutation
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

  // Approve request mutation (host)
  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("approve_rsvp_request", {
        _request_id: requestId,
        _host_id: user!.id,
      });
      if (error) throw error;
      if (!data) throw new Error("Could not approve request");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvp_requests", id] });
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
      toast({ title: "Request approved" });
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  // Decline request mutation (host)
  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("rsvp_requests")
        .update({ status: "declined", decided_by: user!.id, decided_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvp_requests", id] });
      toast({ title: "Request declined" });
    },
    onError: (err: any) => {
      toast({ title: "Decline failed", description: err.message, variant: "destructive" });
    },
  });

  // Post an update (host only)
  const handlePostUpdate = async () => {
    if (!updateBody.trim() || !user || !id) return;
    setIsPostingUpdate(true);
    try {
      let imageUrl: string | null = null;
      if (updateImage) {
        const ext = updateImage.name.split(".").pop();
        const path = `updates/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("event-images")
          .upload(path, updateImage);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("event-images")
          .getPublicUrl(path);
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

      // Send host update email + SMS to all going/maybe RSVPs (fire-and-forget)
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

          // Email
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

          // SMS
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

  // Upload a photo (any RSVP'd user)
  const handlePhotoUpload = async (file: File) => {
    if (!user || !id) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `photos/${id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("event-images")
        .upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("event-images")
        .getPublicUrl(path);
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
          return { action: "removed" as const, status };
        } else {
          const { error } = await supabase
            .from("rsvps")
            .update({ status })
            .eq("id", myRsvp.id);
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

      // Send RSVP confirmation email (fire-and-forget)
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
      toast({
        title: "RSVP failed",
        description: err.message,
        variant: "destructive",
      });
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

  // Determine if this is a request_to_join event and user needs to request access
  const isRequestToJoin = event.privacy === "request_to_join";
  const needsRequestToJoin = isRequestToJoin && !isHost && !myRsvp;
  const hasPendingRequest = myRequest?.status === "pending";
  const wasDeclined = myRequest?.status === "declined";

  const canChat = isHost || myRsvp?.status === "going" || myRsvp?.status === "maybe";

  const chatLabel = unreadChatCount > 0 ? `Chat (${unreadChatCount})` : "Chat";
  const tabs: { key: TabKey; label: string; hasUnread?: boolean }[] = [
    { key: "about", label: "About" },
    { key: "guests", label: `Guests (${goingRsvps.length})${isHost && pendingRequests.length > 0 ? ` · ${pendingRequests.length} pending` : ""}` },
    ...(canChat ? [{ key: "chat" as TabKey, label: chatLabel, hasUnread: unreadChatCount > 0 }] : []),
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

  // Privacy badge
  const privacyBadge = event.privacy === "invite_only"
    ? { icon: Lock, label: "Invite Only" }
    : event.privacy === "request_to_join"
    ? { icon: UserCheck, label: "Request to Join" }
    : { icon: Globe, label: "Open" };
  const PrivacyIcon = privacyBadge.icon;

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
          <div className="absolute top-12 right-5 flex gap-2">
            {isHost && event.status !== 'cancelled' && (
              <div className="relative">
                <button
                  onClick={() => setShowHostMenu(!showHostMenu)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
                >
                  <MoreHorizontal className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                </button>
                {showHostMenu && (
                  <div className="absolute right-0 top-11 w-44 rounded-2xl border border-border bg-card shadow-lg overflow-hidden z-30">
                    <button
                      onClick={() => { setShowHostMenu(false); navigate(`/create?edit=${id}`); }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      Edit event
                    </button>
                    <button
                      onClick={() => { setShowHostMenu(false); setShowCancelConfirm(true); }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors"
                    >
                      <Ban className="h-4 w-4" strokeWidth={1.5} />
                      Cancel event
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate("/")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
            >
              <Home className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
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
          <div className="absolute top-12 right-5 flex gap-2">
            {isHost && event.status !== 'cancelled' && (
              <div className="relative">
                <button
                  onClick={() => setShowHostMenu(!showHostMenu)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
                >
                  <MoreHorizontal className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                </button>
                {showHostMenu && (
                  <div className="absolute right-0 top-11 w-44 rounded-2xl border border-border bg-card shadow-lg overflow-hidden z-30">
                    <button
                      onClick={() => { setShowHostMenu(false); navigate(`/create?edit=${id}`); }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      Edit event
                    </button>
                    <button
                      onClick={() => { setShowHostMenu(false); setShowCancelConfirm(true); }}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors"
                    >
                      <Ban className="h-4 w-4" strokeWidth={1.5} />
                      Cancel event
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate("/")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
            >
              <Home className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Event header */}
      <div className="mx-auto max-w-lg px-5 -mt-6 relative z-10">
        <div className="space-y-4">
          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {event.status === 'cancelled' && (
              <span className="pill-tag bg-destructive text-destructive-foreground">
                Cancelled
              </span>
            )}
            <span className="pill-tag bg-primary text-primary-foreground">
              {isFree ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`}
            </span>
            {!isFree && event.status !== 'cancelled' && (
              <span className="pill-tag border border-border text-muted-foreground">
                Payment required
              </span>
            )}
            {/* Privacy badge */}
            <span className="pill-tag border border-border text-muted-foreground flex items-center gap-1">
              <PrivacyIcon className="h-3 w-3" strokeWidth={1.5} />
              {privacyBadge.label}
            </span>
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
              <p className="label-meta text-muted-foreground">Hosted by {hostProfile?.full_name || "the organizer"}</p>
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
              <span className="label-meta relative">
                {t.label}
                {t.hasUnread && tab !== t.key && (
                  <span className="absolute -top-1 -right-2 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-lg px-5 mt-5">
        {tab === "about" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="label-meta text-muted-foreground">Event Description</h3>
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

            {/* Photo gallery on About tab */}
            {photos.length > 0 && (
              <div className="space-y-3">
                <h3 className="label-meta text-muted-foreground">Photos ({photos.length})</h3>
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
                          <span className="text-white font-display text-lg">+{photos.length - 9}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Host photo upload */}
            {isHost && (
              <div>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 transition-colors hover:bg-background"
                >
                  {photoUploading ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {photoUploading ? "Uploading…" : "Add photos"}
                  </span>
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
            {/* Host: pending requests section */}
            {isHost && pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="label-meta text-accent">
                  Pending Requests ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((req: any) => {
                    const profile = req.profiles;
                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-accent/30 bg-card p-4 space-y-3"
                      >
                        <div className="flex items-center gap-3">
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
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {profile?.full_name || "Member"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(req.created_at), "MMM d · h:mm a")}
                            </p>
                          </div>
                        </div>
                        {req.message && (
                          <p className="text-sm text-muted-foreground italic">
                            "{req.message}"
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveRequestMutation.mutate(req.id)}
                            disabled={approveRequestMutation.isPending || declineRequestMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" strokeWidth={1.5} />
                            <span className="label-meta">Approve</span>
                          </button>
                          <button
                            onClick={() => declineRequestMutation.mutate(req.id)}
                            disabled={approveRequestMutation.isPending || declineRequestMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-border bg-card py-2.5 text-muted-foreground transition-all hover:text-foreground disabled:opacity-50"
                          >
                            <X className="h-4 w-4" strokeWidth={1.5} />
                            <span className="label-meta">Decline</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Host dashboard stats — only for host on paid events */}
            {isHost && !isFree && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="label-meta text-muted-foreground">Payment Overview</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-background p-3 text-center">
                    <p className="font-display text-2xl text-foreground">{goingRsvps.length}</p>
                    <p className="label-meta text-muted-foreground mt-1">Going</p>
                  </div>
                  <div className="rounded-xl bg-background p-3 text-center">
                    <p className="font-display text-2xl text-primary">{goingRsvps.filter((r: any) => r.paid).length}</p>
                    <p className="label-meta text-muted-foreground mt-1">Paid</p>
                  </div>
                  <div className="rounded-xl bg-background p-3 text-center">
                    <p className="font-display text-2xl text-destructive">{goingRsvps.filter((r: any) => !r.paid).length}</p>
                    <p className="label-meta text-muted-foreground mt-1">Unpaid</p>
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

                        // SMS payment reminder
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
                    className="w-full flex items-center justify-center gap-2 rounded-full border border-border bg-background py-3 transition-colors hover:bg-card"
                  >
                    <Bell className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                    <span className="label-meta text-foreground">Send Payment Reminders</span>
                  </button>
                )}
              </div>
            )}

            {/* Going */}
            <GuestSection
              label={`Going (${goingRsvps.length})`}
              rsvps={goingRsvps}
              showPaymentStatus={isHost && !isFree}
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
            {rsvps.length === 0 && pendingRequests.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No RSVPs yet — be the first!
              </p>
            )}
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-4">
            {/* Host-only composer */}
            {isHost && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <textarea
                  value={updateBody}
                  onChange={(e) => setUpdateBody(e.target.value)}
                  placeholder="Share an update with your guests…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {updateImagePreview && (
                  <div className="relative">
                    <img src={updateImagePreview} alt="" className="rounded-xl w-full max-h-48 object-cover" />
                    <button
                      onClick={() => { setUpdateImage(null); setUpdateImagePreview(null); }}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm"
                    >
                      <X className="h-3.5 w-3.5 text-foreground" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => updateImageRef.current?.click()}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" strokeWidth={1.5} />
                    <span className="label-meta">Add photo</span>
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
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {isPostingUpdate ? (
                      <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                    )}
                    <span className="label-meta text-primary-foreground">Post</span>
                  </button>
                </div>
              </div>
            )}

            {updates.length === 0 && !isHost ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No updates yet.
              </p>
            ) : updates.length === 0 ? null : (
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
                        {author?.full_name || "Member"}
                      </span>
                      {update.author_id === event.host_id && (
                        <span className="pill-tag bg-sage text-sage-foreground text-[10px] py-0.5 px-2">Host</span>
                      )}
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

        {tab === "chat" && (
          event.status === 'cancelled' ? (
            <div className="text-center py-12 space-y-2">
              <Ban className="h-6 w-6 text-muted-foreground mx-auto" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                This event was cancelled. The chat is now closed.
              </p>
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
              <p className="text-sm text-muted-foreground">
                RSVP to join the conversation.
              </p>
            </div>
          )
        )}
      </div>

      {/* Bottom bar: Request to Join flow for request_to_join events */}
      {needsRequestToJoin && event.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
          <div className="mx-auto max-w-lg px-5 py-4">
            {hasPendingRequest ? (
              <div className="flex items-center justify-center gap-2 rounded-full border border-accent bg-accent/10 py-3">
                <Clock className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span className="label-meta text-accent">Request pending — waiting for host</span>
              </div>
            ) : wasDeclined ? (
              <div className="flex items-center justify-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 py-3">
                <X className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                <span className="label-meta text-destructive">Your request was declined</span>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  onClick={() => requestToJoinMutation.mutate()}
                  disabled={requestToJoinMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {requestToJoinMutation.isPending ? (
                    <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                  )}
                  <span className="label-meta text-primary-foreground">Request to Join</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RSVP bar — free events (not request_to_join without access) */}
      {isFree && event.status !== 'cancelled' && !needsRequestToJoin && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
          <div className="mx-auto max-w-lg px-5 py-4">
            {isHost && (
              <p className="text-center label-meta text-muted-foreground mb-2">You're hosting this event</p>
            )}
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

      {/* Paid events — embedded checkout or paid confirmation (not request_to_join without access) */}
      {!isFree && event.status !== 'cancelled' && !needsRequestToJoin && (
        <>
          {showCheckout && !myRsvp?.paid && (
            <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
              <div className="mx-auto max-w-lg px-5 pt-12 pb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl text-foreground">Complete Payment</h2>
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border"
                  >
                    <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                  </button>
                </div>
                <PaymentTestModeBanner />
                <div className="mt-4 rounded-2xl overflow-hidden border border-border">
                  <EmbeddedCheckoutProvider
                    stripe={getStripe()}
                    options={{ fetchClientSecret }}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              </div>
            </div>
          )}
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-lg z-20">
            <div className="mx-auto max-w-lg px-5 py-4">
              {isHost && (
                <p className="text-center label-meta text-muted-foreground mb-2">You're hosting this event</p>
              )}
              {myRsvp?.paid ? (
                <div className="flex items-center justify-center gap-2 rounded-full bg-primary py-3">
                  <Check className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                  <span className="label-meta text-primary-foreground">
                    You're going — Paid
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 transition-all hover:opacity-90"
                >
                  <DollarSign className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                  <span className="label-meta text-primary-foreground">
                    {`Pay $${(event.price_cents / 100).toFixed(0)} & RSVP`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Photo lightbox carousel */}
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

            {/* Prev button */}
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            )}

            {/* Next button */}
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
            <p className="mt-4 label-meta text-white/60">
              {lightboxIndex + 1} / {photos.length} · swipe or use arrows · tap outside to close
            </p>
          </div>
        );
      })()}

      {/* Cancel event confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-5">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-xl text-foreground">
              Cancel {event.title}?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will notify all guests and refund anyone who's paid. This can't be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="flex-1 rounded-full border border-border bg-card py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Keep event
              </button>
              <button
                onClick={handleCancelEvent}
                disabled={isCancelling}
                className="flex-1 rounded-full bg-destructive py-3 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-50"
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

// Guest section sub-component
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
            {showPaymentStatus && (
              <span className={cn(
                "ml-auto pill-tag",
                rsvp.paid
                  ? "bg-sage text-sage-foreground"
                  : "border border-destructive/30 text-destructive"
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