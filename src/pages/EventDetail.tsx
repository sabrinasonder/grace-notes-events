import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
  Share2,
  Repeat,
} from "lucide-react";
import { describeStoredRecurrence } from "@/lib/recurrence";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BottomNav } from "@/components/BottomNav";

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
  const [inviteTab, setInviteTab] = useState<"members" | "new">("members");
  const [inviteNewName, setInviteNewName] = useState("");
  const [inviteNewEmail, setInviteNewEmail] = useState("");
  const [isInvitingNew, setIsInvitingNew] = useState(false);
  const [paymentToggleConfirm, setPaymentToggleConfirm] = useState<{
    rsvpId: string;
    guestId: string;
    guestName: string;
    currentPaid: boolean;
  } | null>(null);
  const [showPaymentLog, setShowPaymentLog] = useState(false);
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [showCancelScopeModal, setShowCancelScopeModal] = useState(false);
  const [isCancellingRecurring, setIsCancellingRecurring] = useState(false);
  const [showAddCohost, setShowAddCohost] = useState(false);
  const [cohostSearch, setCohostSearch] = useState("");
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isFavorited, toggleFavorite } = useFavorites();

  // Show success toast when returning from Stripe checkout
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast({ title: "Payment confirmed!", description: "You're all set — see you there." });
      // Strip param from URL without a re-navigation
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
      // Refresh RSVP data (webhook may have already updated, but invalidate to be safe)
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
    }
  }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, profiles!events_host_id_fkey(full_name, avatar_url)")
        .eq("id", id!)
        .maybeSingle();
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
        .select("*, profiles!rsvp_requests_user_id_fkey(full_name, avatar_url)")
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
        .eq("event_id", id!)
        .neq("status", "declined" as any);
      if (error) throw error;
      if (!data?.length) return [];
      // Fetch profile names — invited_user_id has no FK so we do a separate lookup
      const userIds = data.map((inv: any) => inv.invited_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds);
      return data.map((inv: any) => ({
        ...inv,
        profile: profiles?.find((p: any) => p.id === inv.invited_user_id) ?? null,
      }));
    },
    enabled: !!id && !!user,
  });

  // Dedicated check: does the current user have a non-declined invite to this event?
  // This is kept separate from eventInvites (the host's guest list query) because that
  // query can fail silently, which would incorrectly set isInvited = false.
  const { data: myInvite = null } = useQuery({
    queryKey: ["my_event_invite", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_invites")
        .select("id, status")
        .eq("event_id", id!)
        .eq("invited_user_id", user!.id)
        .maybeSingle();
      if (error) {
        console.warn("[EventDetail] invite check failed:", error);
        return null;
      }
      return data;
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
    enabled: !!user && (showInviteMembers || showAddCohost),
  });

  const { data: eventHosts = [] } = useQuery({
    queryKey: ["event_hosts", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_hosts")
        .select("*, profiles!event_hosts_user_id_fkey(full_name, avatar_url)")
        .eq("event_id", id!);
      if (error) return [];
      return data as any[];
    },
    enabled: !!id && !!user,
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      // Upsert so re-inviting a previously declined member reactivates their invite
      const { error } = await (supabase as any).from("event_invites").upsert(
        { event_id: id!, invited_user_id: memberId, invited_by: user!.id, status: "pending" },
        { onConflict: "event_id,invited_user_id" }
      );
      if (error) throw error;
      try {
        // Always look up email fresh from profiles — don't rely on allMembers state
        // (allMembers is lazily loaded and may be empty when called from handleInviteNewMember)
        const { data: memberProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", memberId)
          .maybeSingle();
        if (memberProfile?.email && event) {
          const hostName = user?.user_metadata?.full_name || "The host";
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "event-invite",
              recipientEmail: memberProfile.email,
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
        toast({ title: "Invite sent, but notification email failed", variant: "destructive" });
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

  const resendInviteMutation = useMutation({
    mutationFn: async (inv: any) => {
      if (!inv.profile?.email || !event) return;
      const hostName = user?.user_metadata?.full_name || "The host";
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "event-invite",
          recipientEmail: inv.profile.email,
          idempotencyKey: `event-invite-resend-${id}-${inv.invited_user_id}-${Date.now()}`,
          templateData: {
            eventTitle: event.title,
            eventDate: format(new Date(event.starts_at), "EEEE, MMMM d 'at' h:mm a"),
            hostName,
            eventUrl: `${window.location.origin}/event/${id}`,
          },
        },
      });
    },
    onSuccess: () => toast({ title: "Invite resent!" }),
    onError: () => toast({ title: "Failed to resend invite", variant: "destructive" }),
  });

  const removeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      // Set to declined rather than delete — preserves audit trail and keeps
      // existing RSVPs intact (can_view_event checks rsvps independently).
      const { error } = await supabase
        .from("event_invites")
        .update({ status: "declined" as any })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_invites", id] });
      toast({ title: "Invite removed" });
    },
    onError: (err: any) => toast({ title: "Failed to remove invite", description: err.message, variant: "destructive" }),
  });

  const addCohostMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await (supabase as any).from("event_hosts").insert({
        event_id: id,
        user_id: memberId,
        role: "co-host",
        added_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_hosts", id] });
      toast({ title: "Co-host added!" });
      setCohostSearch("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to add co-host", description: err.message, variant: "destructive" });
    },
  });

  const removeCohostMutation = useMutation({
    mutationFn: async (cohostUserId: string) => {
      const { error } = await (supabase as any)
        .from("event_hosts")
        .delete()
        .eq("event_id", id)
        .eq("user_id", cohostUserId)
        .eq("role", "co-host");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_hosts", id] });
      toast({ title: "Co-host removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove co-host", description: err.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ rsvpId, guestId, paid }: { rsvpId: string; guestId: string; paid: boolean }) => {
      const { error } = await supabase
        .from("rsvps")
        .update({ paid })
        .eq("id", rsvpId);
      if (error) throw error;
      // Write audit log (ignore failure — doesn't block the paid update)
      await (supabase as any).from("rsvp_payment_logs").insert({
        rsvp_id: rsvpId,
        event_id: id,
        guest_id: guestId,
        changed_by: user!.id,
        paid,
      });
    },
    onSuccess: (_, { paid }) => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", id] });
      queryClient.invalidateQueries({ queryKey: ["payment_logs", id] });
      toast({ title: paid ? "Marked as paid" : "Marked as not paid" });
      setPaymentToggleConfirm(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const { data: paymentLogs = [] } = useQuery({
    queryKey: ["payment_logs", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rsvp_payment_logs")
        .select("*, changer:changed_by(full_name), guest:guest_id(full_name)")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data as any[];
    },
    enabled: !!id && !!user,
  });

  const sendPaymentReminder = async (rsvp: any) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, phone, phone_verified")
        .eq("id", rsvp.user_id)
        .maybeSingle();
      const hostName = (event?.profiles as any)?.full_name || "Your host";
      const eventUrl = `${window.location.origin}/event/${id}`;
      if (profileData?.email) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "host-update",
            recipientEmail: profileData.email,
            idempotencyKey: `pay-reminder-${rsvp.id}-${Date.now()}`,
            templateData: {
              eventTitle: event?.title,
              hostName,
              message: `Just a friendly reminder to complete your payment of $${((event?.price_cents || 0) / 100).toFixed(0)} for this event. Tap below to pay and confirm your spot.`,
              eventUrl,
            },
          },
        });
      }
      if (profileData?.phone && profileData?.phone_verified) {
        supabase.functions.invoke("send-sms", {
          body: {
            to: profileData.phone,
            message: `${hostName}: Reminder to complete payment for ${event?.title}. ${eventUrl}`,
          },
        });
      }
      toast({ title: "Reminder sent!" });
    } catch (err: any) {
      toast({ title: "Failed to send reminder", description: err.message, variant: "destructive" });
    }
  };

  const handleInviteNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;
    const trimmedName = inviteNewName.trim();
    const trimmedEmail = inviteNewEmail.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) return;
    setIsInvitingNew(true);
    try {
      // Check if this email already belongs to an app member
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();
      if (existing) {
        // Already a member — send event invite directly
        await inviteMemberMutation.mutateAsync(existing.id);
        setInviteNewName("");
        setInviteNewEmail("");
        return;
      }
      // Not a member yet — create an app invite with event context in the note
      const { data: invite, error } = await supabase
        .from("invites")
        .insert({
          inviter_id: user.id,
          invitee_email: trimmedEmail,
          invitee_name: trimmedName,
          personal_note: `I'd love for you to join me at ${event.title}. Sign up and I'll add you to the event!`,
        })
        .select()
        .single();
      if (error) throw error;
      const { data: hostProfile } = await supabase
        .from("profiles")
        .select("full_name, city")
        .eq("id", user.id)
        .single();
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "circle-invite",
          recipientEmail: trimmedEmail,
          idempotencyKey: `circle-invite-${invite.id}`,
          templateData: {
            inviterName: hostProfile?.full_name || "Your host",
            inviteeName: trimmedName,
            personalNote: `I'd love for you to join me at ${event.title}. Sign up and I'll add you to the event!`,
            city: hostProfile?.city || null,
            acceptUrl: `${window.location.origin}/accept-invite?token=${invite.token}`,
          },
        },
      });
      setInviteNewName("");
      setInviteNewEmail("");
      toast({ title: "Invite sent!", description: `${trimmedName} will receive an email to join Sonder Circle.` });
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setIsInvitingNew(false);
    }
  };

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

  const handleCancelFutureFrom = async () => {
    if (!event || !id) return;
    const eventAny = event as any;
    const parentId = eventAny.parent_event_id || (eventAny.is_recurring_parent ? id : null);
    if (!parentId) return;
    setIsCancellingRecurring(true);
    try {
      // Set recurrence_end_date on parent to day before this event
      const dayBefore = new Date(event.starts_at);
      dayBefore.setDate(dayBefore.getDate() - 1);
      await (supabase as any)
        .from("events")
        .update({ recurrence_end_date: dayBefore.toISOString().split("T")[0] })
        .eq("id", parentId);
      // Cancel this instance and all future instances
      await (supabase as any)
        .from("events")
        .update({ status: "cancelled" })
        .eq("parent_event_id", parentId)
        .gte("starts_at", event.starts_at);
      // Also cancel this event if it's an instance (not the parent itself)
      if (eventAny.parent_event_id) {
        await supabase.from("events").update({ status: "cancelled" }).eq("id", id);
      }
      setShowCancelScopeModal(false);
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "This event and all future events cancelled." });
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    } finally {
      setIsCancellingRecurring(false);
    }
  };

  const handleCancelEntireSeries = async () => {
    if (!event || !id) return;
    const eventAny = event as any;
    const parentId = eventAny.parent_event_id || (eventAny.is_recurring_parent ? id : null);
    if (!parentId) return;
    setIsCancellingRecurring(true);
    try {
      // Cancel all instances
      await (supabase as any)
        .from("events")
        .update({ status: "cancelled" })
        .eq("parent_event_id", parentId);
      // Cancel the parent too
      await supabase.from("events").update({ status: "cancelled" }).eq("id", parentId);
      setShowCancelScopeModal(false);
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Entire series cancelled." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Failed to cancel series", description: err.message, variant: "destructive" });
    } finally {
      setIsCancellingRecurring(false);
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
            });
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
        toast({ title: "Request declined, but notification email failed", variant: "destructive" });
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
            });
          }
          if (profileData?.phone && profileData?.phone_verified) {
            supabase.functions.invoke("send-sms", {
              body: {
                to: profileData.phone,
                message: `${hostName} posted an update for ${event.title}: ${truncatedUpdate} ${window.location.origin}/event/${id}`,
              },
            });
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
      // For paid events: show payment sheet when going
      if (result?.action === "created" && result.status === "going" && event && event.price_cents > 0) {
        setShowPaymentSheet(true);
      }
      // When an invited guest responds (any action except removing), update invite + dismiss notification
      if (isInvited && result?.action !== "removed") {
        const newInviteStatus =
          result.status === "going" || result.status === "maybe" ? "accepted" : "declined";
        supabase
          .from("event_invites")
          .update({ status: newInviteStatus as any })
          .eq("event_id", id!)
          .eq("invited_user_id", user!.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["event_invites", id] });
            queryClient.invalidateQueries({ queryKey: ["pending-event-invites-banner", user?.id] });
          });
        // Dismiss the event_invite notification so it no longer appears on the home feed
        supabase
          .from("notifications" as any)
          .update({ is_read: true, is_dismissed: true })
          .eq("user_id", user!.id)
          .eq("type", "event_invite")
          .eq("related_event_id", id!)
          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }));
      }
      // Show a warm toast and skip confirmation email for first-time invite responses
      if (result?.action === "created" && isInvited) {
        const hostFirstName = (event?.profiles as any)?.full_name?.split(" ")[0] || "the host";
        if (result.status === "going" && isFree) {
          toast({ title: "You're going! 🎉" });
        } else if (result.status === "maybe") {
          toast({ title: "Got it!", description: `We'll let ${hostFirstName} know you might make it` });
        } else if (result.status === "declined") {
          toast({ title: "No worries", description: `We'll let ${hostFirstName} know` });
        }
        return; // skip confirmation email — they already received an invite email
      }
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
        });
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

  if (!user) return <Navigate to={`/join?redirect=/event/${id}`} replace />;
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
  const isHost = event.host_id === user.id || eventHosts.some((h: any) => h.user_id === user.id);
  // Build display list: prefer event_hosts (has all hosts including creator), fall back to host_id profile
  const displayHosts: { full_name: string; avatar_url: string | null; user_id: string; role: string }[] =
    eventHosts.length > 0
      ? eventHosts.map((h: any) => ({ ...h.profiles, user_id: h.user_id, role: h.role }))
      : [{ full_name: hostProfile?.full_name || "Host", avatar_url: hostProfile?.avatar_url ?? null, user_id: event.host_id, role: "creator" }];
  const getHostNamesDisplay = (hosts: typeof displayHosts) => {
    const names = hosts.map((h) => (h?.full_name || "Host").split(" ")[0]);
    if (names.length === 0) return "Host";
    if (names.length === 1) return hosts[0]?.full_name || "Host";
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2} others`;
  };
  const eventAny = event as any;
  const isRecurring = !!(eventAny.parent_event_id || eventAny.is_recurring_parent);
  const parentEventId: string | null =
    eventAny.parent_event_id ?? (eventAny.is_recurring_parent ? id! : null);
  const recurrenceLabel = describeStoredRecurrence(
    eventAny.recurrence_type,
    eventAny.recurrence_rule
  );
  const isFree = event.price_cents === 0;
  const goingRsvps = rsvps.filter((r: any) => r.status === "going");
  const maybeRsvps = rsvps.filter((r: any) => r.status === "maybe");
  const declinedRsvps = rsvps.filter((r: any) => r.status === "declined");
  const spotsLeft = event.capacity != null ? event.capacity - goingRsvps.length : null;
  const isRequestToJoin = event.privacy === "request_to_join";
  const isInviteOnly = event.privacy === "invite_only";
  // Use the dedicated myInvite query — more reliable than scanning the shared eventInvites array
  const isInvited = !!myInvite && myInvite.status !== "declined";
  const needsRequestToJoin = (isRequestToJoin || isInviteOnly) && !isInvited && !isHost && !myRsvp;
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
          <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" style={{ objectPosition: (event as any).cover_image_position || "50% 50%" }} />
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
          className="absolute left-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
          style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
        </button>

        {/* Top-right: Menu + Home */}
        <div className="absolute right-4 flex gap-1.5" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}>
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
                    onClick={() => {
                      setShowHostMenu(false);
                      if (isRecurring) {
                        setShowEditScopeModal(true);
                      } else {
                        navigate(`/create?edit=${id}`);
                      }
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-sans text-cocoa hover:bg-cream transition-colors"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    Edit event
                  </button>
                  <button
                    onClick={() => {
                      setShowHostMenu(false);
                      if (isRecurring) {
                        setShowCancelScopeModal(true);
                      } else {
                        setShowCancelConfirm(true);
                      }
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-sans text-destructive hover:bg-cream transition-colors"
                  >
                    <Ban className="h-4 w-4" strokeWidth={1.5} />
                    Cancel event
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={async () => {
              const url = window.location.href;
              if (navigator.share) {
                try { await navigator.share({ title: event.title, text: `Join me at ${event.title}`, url }); } catch {}
              } else {
                try { await navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); } catch {}
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
          >
            <Share2 className="h-4 w-4 text-cocoa" strokeWidth={1.5} />
          </button>
          {id && (
            <button
              onClick={() => toggleFavorite(id)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} fill={isFavorited(id) ? "#D89B86" : "none"} color={isFavorited(id) ? "#D89B86" : "#3A2A20"} />
            </button>
          )}
        </div>

        {/* Hero pills (price + privacy) */}
        <div className="absolute left-20 flex gap-2 flex-wrap max-w-[55%]" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}>
          {event.status === "cancelled" && (
            <span className="rounded-full bg-destructive px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
              Cancelled
            </span>
          )}

          {/* ── Price badge ── */}
          {isFree ? (
            <span className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm">
              Free
            </span>
          ) : myRsvp?.paid ? (
            <span className="rounded-full bg-sage/90 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm flex items-center gap-1">
              <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
              ${(event.price_cents / 100).toFixed(0)} Paid
            </span>
          ) : (
            <button
              onClick={() => setShowPaymentSheet(true)}
              className="rounded-full bg-blush px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm flex items-center gap-1 transition-opacity hover:opacity-90"
            >
              <CreditCard className="h-2.5 w-2.5" strokeWidth={2} />
              ${(event.price_cents / 100).toFixed(0)} — Pay
            </button>
          )}

          {/* ── Privacy / Invite badge ── */}
          {isHost ? (
            // Hosts see an action button only for restricted events; open events show no badge here
            isInviteOnly || isRequestToJoin ? (
              <button
                onClick={() => setShowInviteSheet(true)}
                className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm flex items-center gap-1 transition-opacity hover:opacity-90"
              >
                <UserPlus className="h-2.5 w-2.5" strokeWidth={2} />
                Invite
              </button>
            ) : null
          ) : isRequestToJoin && hasPendingRequest ? (
            <span className="rounded-full bg-blush/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" strokeWidth={2} />
              Pending
            </span>
          ) : isRequestToJoin && !myRsvp ? (
            <button
              onClick={() => requestToJoinMutation.mutate()}
              disabled={requestToJoinMutation.isPending}
              className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm flex items-center gap-1 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <UserCheck className="h-2.5 w-2.5" strokeWidth={2} />
              {requestToJoinMutation.isPending ? "Sending…" : "Request"}
            </button>
          ) : isInviteOnly && !myRsvp ? (
            <span className="rounded-full bg-cocoa/80 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background backdrop-blur-sm flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" strokeWidth={2} />
              Invite Only
            </span>
          ) : null}
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
          {/* Avatar stack */}
          <div className="flex -space-x-2.5 shrink-0">
            {displayHosts.slice(0, 3).map((h, idx) => {
              const ini = (h?.full_name || "?").split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
              return h?.avatar_url ? (
                <img key={idx} src={h.avatar_url} alt="" className="h-[42px] w-[42px] rounded-full object-cover ring-2 ring-background" />
              ) : (
                <div key={idx} className="h-[42px] w-[42px] rounded-full bg-blush/30 flex items-center justify-center font-serif text-sm text-espresso ring-2 ring-background">
                  {ini}
                </div>
              );
            })}
            {displayHosts.length > 3 && (
              <div className="h-[42px] w-[42px] rounded-full bg-cream flex items-center justify-center font-sans text-xs text-taupe ring-2 ring-background">
                +{displayHosts.length - 3}
              </div>
            )}
          </div>
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
              Hosted By
            </p>
            <p className="font-serif text-[17px] text-espresso">
              {getHostNamesDisplay(displayHosts)}
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
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex flex-col items-center gap-1.5 w-full hover:opacity-70 transition-opacity">
                <Calendar className="h-4 w-4 text-blush" strokeWidth={1.5} />
                <p className="font-sans text-[13px] font-semibold text-cocoa">
                  {format(new Date(event.starts_at), "EEE, MMM d")}
                </p>
                <p className="font-sans text-xs text-taupe">
                  {format(new Date(event.starts_at), "h:mm a")}
                </p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 rounded-xl" align="center">
              <button
                onClick={calendarBlock.downloadIcs}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-sans text-cocoa transition-colors hover:bg-cream"
              >
                Apple / iOS Calendar
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
          {event.location ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 hover:opacity-70 transition-opacity"
            >
              <MapPin className="h-4 w-4 text-blush" strokeWidth={1.5} />
              <p className="font-sans text-[13px] font-semibold text-cocoa line-clamp-1">
                {event.location.split(",")[0]}
              </p>
              <p className="font-sans text-xs text-taupe line-clamp-1">
                {event.location.split(",").slice(1).join(",").trim() || "View map"}
              </p>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blush" strokeWidth={1.5} />
              <p className="font-sans text-xs font-semibold text-cocoa">TBD</p>
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <Users className="h-4 w-4 text-blush" strokeWidth={1.5} />
            <p className="font-sans text-[13px] font-semibold text-cocoa">
              {goingRsvps.length} going
            </p>
            {spotsLeft !== null && (
              <p className="font-sans text-xs text-taupe">
                {spotsLeft} spots left
              </p>
            )}
          </div>
        </div>

        {/* Add to Calendar (only for going guests) */}
        {calendarBlock && myRsvp?.status === "going" && (
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

      {/* ── RECURRENCE ROW ───────────────────────────────────────── */}
      {isRecurring && recurrenceLabel && (
        <div className="mx-auto max-w-lg px-6 py-3 border-b border-cream">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-blush shrink-0" strokeWidth={1.5} />
              <span className="font-sans text-[13px] text-cocoa">{recurrenceLabel}</span>
            </div>
            {parentEventId && (
              <button
                onClick={() => navigate(`/series/${parentEventId}`)}
                className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-taupe hover:text-cocoa transition-colors"
              >
                View series
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PAYMENT DUE BANNER (unpaid going member) ─────────────── */}
      {!isFree && myRsvp?.status === "going" && !myRsvp?.paid && event.status !== "cancelled" && (
        <div className="mx-auto max-w-lg px-6 py-3 border-b border-cream">
          <div className="flex items-center gap-3 rounded-2xl bg-blush/10 border border-blush/25 px-4 py-3.5">
            <CreditCard className="h-5 w-5 text-blush shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-blush">Payment due</p>
              <p className="font-sans text-xs text-cocoa mt-0.5">
                You're going! ${(event.price_cents / 100).toFixed(0)} per guest
              </p>
            </div>
            <button
              onClick={() => setShowPaymentSheet(true)}
              className="shrink-0 rounded-full bg-blush px-4 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

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
            {/* Hosts section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
                  {displayHosts.length > 1 ? `Hosts · ${displayHosts.length}` : "Host"}
                </p>
                {isHost && event.status !== "cancelled" && (
                  <button
                    onClick={() => setShowAddCohost(!showAddCohost)}
                    className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream/80"
                  >
                    <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {showAddCohost ? "Close" : "Add Co-host"}
                  </button>
                )}
              </div>

              {showAddCohost && isHost && (
                <div className="space-y-2 rounded-2xl border border-cream bg-paper p-3">
                  <input
                    type="text"
                    value={cohostSearch}
                    onChange={(e) => setCohostSearch(e.target.value)}
                    placeholder="Search members…"
                    className="w-full rounded-full border border-cream bg-background px-4 py-2.5 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allMembers
                      .filter((m: any) => {
                        if (!cohostSearch.trim()) return true;
                        return (m.full_name || "").toLowerCase().includes(cohostSearch.toLowerCase());
                      })
                      .filter((m: any) => !eventHosts.some((h: any) => h.user_id === m.id))
                      .map((m: any) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addCohostMutation.mutate(m.id)}
                          disabled={addCohostMutation.isPending}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-cream transition-colors text-left disabled:opacity-50"
                        >
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso shrink-0">
                              {(m.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-sans text-sm text-espresso">{m.full_name}</span>
                        </button>
                      ))}
                    {allMembers.filter((m: any) => !eventHosts.some((h: any) => h.user_id === m.id)).length === 0 && (
                      <p className="text-sm font-sans text-taupe text-center py-3">All members are already co-hosts</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-0">
                {displayHosts.map((h, idx) => {
                  const initials = (h?.full_name || "?").split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
                  const isCreator = h.role === "creator" || h.user_id === event.host_id;
                  return (
                    <div key={h.user_id || idx} className="flex items-center gap-3 border-b border-cream py-3 last:border-b-0">
                      {h?.avatar_url ? (
                        <img src={h.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso">
                          {initials}
                        </div>
                      )}
                      <span className="flex-1 font-sans text-sm text-espresso">{h?.full_name || "Host"}</span>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em]",
                        isCreator ? "bg-cocoa/10 text-cocoa" : "bg-blush/20 text-blush"
                      )}>
                        {isCreator ? "Creator" : "Co-host"}
                      </span>
                      {isHost && !isCreator && (
                        <button
                          onClick={() => removeCohostMutation.mutate(h.user_id)}
                          disabled={removeCohostMutation.isPending}
                          className="ml-1 rounded-full p-1.5 hover:bg-cream transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-taupe" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

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

            {/* Host: Invite Members (invite_only + request_to_join) */}
            {isHost && (event.privacy === "invite_only" || event.privacy === "request_to_join") && event.status !== "cancelled" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Invite Guests</p>
                  <button
                    onClick={() => setShowInviteMembers(!showInviteMembers)}
                    className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream/80"
                  >
                    <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {showInviteMembers ? "Close" : "Add"}
                  </button>
                </div>

                {eventInvites.length > 0 && (
                  <div className="space-y-2">
                    {eventInvites.map((inv: any) => {
                      const name = inv.profile?.full_name || "Member";
                      const initials = name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                      const isPending = inv.status === "pending";
                      return (
                        <div key={inv.id} className="flex items-center gap-3 rounded-2xl bg-cream/50 px-3.5 py-2.5">
                          {/* Avatar */}
                          {inv.profile?.avatar_url ? (
                            <img src={inv.profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[9px] text-espresso flex-shrink-0">
                              {initials}
                            </div>
                          )}
                          {/* Name + status */}
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-[12px] font-semibold text-espresso truncate">{name}</p>
                            <p className="font-sans text-[10px] text-taupe uppercase tracking-[0.15em]">{inv.status}</p>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isPending && (
                              <button
                                onClick={() => resendInviteMutation.mutate(inv)}
                                disabled={resendInviteMutation.isPending}
                                className="rounded-full border border-cocoa/30 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-cocoa hover:bg-cocoa/5 transition-colors disabled:opacity-40"
                              >
                                Resend
                              </button>
                            )}
                            <button
                              onClick={() => removeInviteMutation.mutate(inv.id)}
                              disabled={removeInviteMutation.isPending}
                              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-cream transition-colors disabled:opacity-40"
                            >
                              <X className="h-3 w-3 text-taupe" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showInviteMembers && (
                  <div className="border-b border-cream pb-5 space-y-4">
                    {/* Tabs */}
                    <div className="flex rounded-full border border-cream bg-paper p-0.5">
                      <button
                        onClick={() => setInviteTab("members")}
                        className={cn(
                          "flex-1 rounded-full py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors",
                          inviteTab === "members" ? "bg-cocoa text-background" : "text-taupe hover:text-cocoa"
                        )}
                      >
                        App Members
                      </button>
                      <button
                        onClick={() => setInviteTab("new")}
                        className={cn(
                          "flex-1 rounded-full py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors",
                          inviteTab === "new" ? "bg-cocoa text-background" : "text-taupe hover:text-cocoa"
                        )}
                      >
                        Invite New
                      </button>
                    </div>

                    {inviteTab === "members" && (
                      <>
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
                      </>
                    )}

                    {inviteTab === "new" && (
                      <form onSubmit={handleInviteNewMember} className="space-y-3">
                        <p className="font-sans text-[11px] text-taupe leading-relaxed">
                          Send them an invitation to join Sonder Circle. If they're already a member, they'll be added directly.
                        </p>
                        <input
                          type="text"
                          required
                          value={inviteNewName}
                          onChange={(e) => setInviteNewName(e.target.value)}
                          placeholder="Their name"
                          className="w-full rounded-full border border-cream bg-paper px-4 py-2.5 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                        />
                        <input
                          type="email"
                          required
                          value={inviteNewEmail}
                          onChange={(e) => setInviteNewEmail(e.target.value)}
                          placeholder="their@email.com"
                          className="w-full rounded-full border border-cream bg-paper px-4 py-2.5 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
                        />
                        <button
                          type="submit"
                          disabled={isInvitingNew}
                          className="w-full flex items-center justify-center gap-2 rounded-full bg-cocoa py-3 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                          {isInvitingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
                          Send Invite
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payment overview (host, paid events) */}
            {isHost && !isFree && goingRsvps.length > 0 && (
              <div className="border-b border-cream pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Payments</p>
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-[10px] text-taupe">
                      {goingRsvps.filter((r: any) => r.paid).length} / {goingRsvps.length} paid
                    </span>
                    {paymentLogs.length > 0 && (
                      <button
                        onClick={() => setShowPaymentLog((v) => !v)}
                        className="font-sans text-[9px] underline text-taupe underline-offset-2"
                      >
                        {showPaymentLog ? "Hide log" : "View log"}
                      </button>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-cream overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sage transition-all"
                    style={{ width: goingRsvps.length > 0 ? `${(goingRsvps.filter((r: any) => r.paid).length / goingRsvps.length) * 100}%` : "0%" }}
                  />
                </div>
                {/* Payment log */}
                {showPaymentLog && paymentLogs.length > 0 && (
                  <div className="rounded-xl border border-cream bg-background px-3 py-2 space-y-1.5">
                    {paymentLogs.map((log: any) => (
                      <p key={log.id} className="font-sans text-[11px] text-taupe leading-relaxed">
                        <span className="text-espresso">{log.changer?.full_name || "Host"}</span> marked{" "}
                        <span className="text-espresso">{log.guest?.full_name || "guest"}</span>{" "}
                        as <span className={log.paid ? "text-sage" : "text-destructive/70"}>{log.paid ? "Paid" : "Not Paid"}</span>{" "}
                        · {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    ))}
                  </div>
                )}
                {/* Per-guest payment rows */}
                <div className="space-y-0">
                  {goingRsvps.map((rsvp: any) => {
                    const profile = rsvp.profiles;
                    const initials = (profile?.full_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                    return (
                      <div key={rsvp.id} className="flex items-center gap-3 border-b border-cream py-3 last:border-b-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-blush/30 flex items-center justify-center font-serif text-xs text-espresso shrink-0">
                            {initials}
                          </div>
                        )}
                        <span className="flex-1 font-sans text-sm text-espresso truncate">{profile?.full_name || "Guest"}</span>
                        {rsvp.paid ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-sage/20 px-2.5 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-sage">
                              Paid
                            </span>
                            <button
                              onClick={() =>
                                setPaymentToggleConfirm({
                                  rsvpId: rsvp.id,
                                  guestId: rsvp.user_id,
                                  guestName: profile?.full_name || "Guest",
                                  currentPaid: true,
                                })
                              }
                              className="rounded-full border border-cream bg-paper px-2 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-taupe hover:bg-cream transition-colors"
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => sendPaymentReminder(rsvp)}
                              className="rounded-full border border-cream bg-paper px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-taupe hover:bg-cream transition-colors"
                            >
                              Remind
                            </button>
                            <button
                              onClick={() =>
                                setPaymentToggleConfirm({
                                  rsvpId: rsvp.id,
                                  guestId: rsvp.user_id,
                                  guestName: profile?.full_name || "Guest",
                                  currentPaid: false,
                                })
                              }
                              disabled={markPaidMutation.isPending}
                              className="rounded-full bg-cocoa px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.15em] text-background hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              Mark Paid
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guest lists */}
            {/* For paid events the host view already shows Going guests above; show simple list for guests + all other sections */}
            {(!isHost || isFree) && <GuestSection label={`Going · ${goingRsvps.length}`} rsvps={goingRsvps} showPaymentStatus={false} />}
            {isHost && !isFree && maybeRsvps.length === 0 && declinedRsvps.length === 0 && goingRsvps.length === 0 && pendingRequests.length === 0 && (
              <p className="font-serif italic text-sm text-taupe text-center py-6">No RSVPs yet.</p>
            )}
            {isHost && isFree && goingRsvps.length > 0 && <GuestSection label={`Going · ${goingRsvps.length}`} rsvps={goingRsvps} showPaymentStatus={false} />}
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
        <div className="fixed bottom-[70px] left-0 right-0 z-20 border-t border-cream bg-background">
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
                  {isInviteOnly && (
                    <p className="font-sans text-[11px] text-taupe text-center">
                      This is an invite-only event. The host will review your request.
                    </p>
                  )}
                  <input
                    type="text"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Add a note to the host (optional)"
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
                    <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-background">Request to Join</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Free events RSVP bar */}
      {isFree && event.status !== "cancelled" && !needsRequestToJoin && (
        <div className="fixed bottom-[70px] left-0 right-0 z-20 border-t border-cream bg-background">
          <div className="px-6 py-3">
            <div className="mx-auto max-w-lg">
              <div className="space-y-2">
                {/* Invited header — shown when guest has a pending invite and hasn't responded */}
                {isInvited && !myRsvp && !isHost && (
                  <div className="flex items-center justify-center pb-0.5">
                    <p className="font-serif text-[14px] text-espresso">
                      {(event.profiles as any)?.full_name
                        ? `${(event.profiles as any).full_name.split(" ")[0]} invited you`
                        : "You're invited!"}
                    </p>
                  </div>
                )}
                {isHost && (
                  <div className="flex items-center justify-between px-1">
                    <p className="font-serif italic text-[12px] text-taupe">You're hosting</p>
                    <button
                      onClick={() => navigate(`/create?edit=${id}`)}
                      className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                )}
              {myRsvp ? (
                /* Has RSVP'd — show current status with ability to change */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => rsvpMutation.mutate("going")}
                      disabled={rsvpMutation.isPending}
                      className={cn(
                        "flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "going"
                          ? "bg-sage/20 text-sage border border-sage/40"
                          : "border border-cream bg-paper text-taupe hover:bg-cream"
                      )}
                    >
                      {myRsvp.status === "going" ? "✓ Going" : "Going"}
                    </button>
                    <button
                      onClick={() => rsvpMutation.mutate("maybe")}
                      disabled={rsvpMutation.isPending}
                      className={cn(
                        "flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "maybe"
                          ? "bg-blush/20 text-blush border border-blush/40"
                          : "border border-cream bg-paper text-taupe hover:bg-cream"
                      )}
                    >
                      {myRsvp.status === "maybe" ? "✓ Maybe" : "Maybe"}
                    </button>
                    <button
                      onClick={() => rsvpMutation.mutate("declined")}
                      disabled={rsvpMutation.isPending}
                      className={cn(
                        "flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "declined"
                          ? "bg-cocoa/10 text-cocoa border border-cocoa/30"
                          : "border border-cream bg-paper text-taupe hover:bg-cream"
                      )}
                    >
                      {myRsvp.status === "declined" ? "✓ Can't go" : "Can't go"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Guest not yet RSVP'd — 3 options */
                <div className="flex gap-2">
                  <button
                    onClick={() => rsvpMutation.mutate("declined")}
                    disabled={rsvpMutation.isPending}
                    className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                  >
                    Can't go
                  </button>
                  <button
                    onClick={() => rsvpMutation.mutate("maybe")}
                    disabled={rsvpMutation.isPending}
                    className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                  >
                    Maybe
                  </button>
                  <button
                    onClick={() => rsvpMutation.mutate("going")}
                    disabled={rsvpMutation.isPending}
                    className="flex-1 rounded-full bg-cocoa py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {rsvpMutation.isPending ? "Saving…" : isInvited ? "Going" : "I'm going"}
                  </button>
                </div>
              )}
              </div>
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
          <div className="fixed bottom-[70px] left-0 right-0 z-20 border-t border-cream bg-background">
            <div className="px-6 py-3">
              <div className="mx-auto max-w-lg">
                {isHost ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="font-serif italic text-[12px] text-taupe">You're hosting</p>
                      <button
                        onClick={() => navigate(`/create?edit=${id}`)}
                        className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-cocoa transition-colors"
                      >
                        Manage →
                      </button>
                    </div>
                    {myRsvp ? (
                      <div className="flex gap-2">
                        <button onClick={() => rsvpMutation.mutate("going")} disabled={rsvpMutation.isPending}
                          className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                            myRsvp.status === "going" ? "bg-sage/20 text-sage border border-sage/40" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                        >{myRsvp.status === "going" ? "✓ Going" : "Going"}</button>
                        <button onClick={() => rsvpMutation.mutate("maybe")} disabled={rsvpMutation.isPending}
                          className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                            myRsvp.status === "maybe" ? "bg-blush/20 text-blush border border-blush/40" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                        >{myRsvp.status === "maybe" ? "✓ Maybe" : "Maybe"}</button>
                        <button onClick={() => rsvpMutation.mutate("declined")} disabled={rsvpMutation.isPending}
                          className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                            myRsvp.status === "declined" ? "bg-cocoa/10 text-cocoa border border-cocoa/30" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                        >{myRsvp.status === "declined" ? "✓ Can't go" : "Can't go"}</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => rsvpMutation.mutate("declined")} disabled={rsvpMutation.isPending}
                          className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                        >Can't go</button>
                        <button onClick={() => rsvpMutation.mutate("maybe")} disabled={rsvpMutation.isPending}
                          className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                        >Maybe</button>
                        <button onClick={() => rsvpMutation.mutate("going")} disabled={rsvpMutation.isPending}
                          className="flex-1 rounded-full bg-cocoa py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                        >I'm going</button>
                      </div>
                    )}
                  </div>
                ) : myRsvp?.paid ? (
                  <div className="flex items-center justify-center gap-2 rounded-full bg-sage/20 py-3.5">
                    <Check className="h-4 w-4 text-sage" strokeWidth={2} />
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-sage">You're confirmed · Paid</span>
                  </div>
                ) : myRsvp?.status === "going" && !myRsvp?.paid ? (
                  <button
                    onClick={() => setShowPaymentSheet(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-blush py-3.5 transition-all hover:opacity-90"
                  >
                    <CreditCard className="h-4 w-4 text-white" strokeWidth={1.5} />
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                      Pay ${(event.price_cents / 100).toFixed(0)} to confirm
                    </span>
                  </button>
                ) : myRsvp && !myRsvp.paid ? (
                  /* Has RSVP (maybe/declined) on paid event — show 3 status buttons */
                  <div className="flex gap-2">
                    <button onClick={() => rsvpMutation.mutate("going")} disabled={rsvpMutation.isPending}
                      className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "going" ? "bg-sage/20 text-sage border border-sage/40" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                    >{myRsvp.status === "going" ? "✓ Going" : "Going"}</button>
                    <button onClick={() => rsvpMutation.mutate("maybe")} disabled={rsvpMutation.isPending}
                      className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "maybe" ? "bg-blush/20 text-blush border border-blush/40" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                    >{myRsvp.status === "maybe" ? "✓ Maybe" : "Maybe"}</button>
                    <button onClick={() => rsvpMutation.mutate("declined")} disabled={rsvpMutation.isPending}
                      className={cn("flex-1 rounded-full py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] transition-all disabled:opacity-50",
                        myRsvp.status === "declined" ? "bg-cocoa/10 text-cocoa border border-cocoa/30" : "border border-cream bg-paper text-taupe hover:bg-cream")}
                    >{myRsvp.status === "declined" ? "✓ Can't go" : "Can't go"}</button>
                  </div>
                ) : isInvited ? (
                  /* Invited guest on paid event — 3 buttons with invited header */
                  <div className="space-y-2">
                    <div className="flex items-center justify-center pb-0.5">
                      <p className="font-serif text-[14px] text-espresso">
                        {(event.profiles as any)?.full_name
                          ? `${(event.profiles as any).full_name.split(" ")[0]} invited you`
                          : "You're invited!"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => rsvpMutation.mutate("declined")}
                        disabled={rsvpMutation.isPending}
                        className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                      >
                        Can't go
                      </button>
                      <button
                        onClick={() => rsvpMutation.mutate("maybe")}
                        disabled={rsvpMutation.isPending}
                        className="rounded-full border border-cream bg-paper py-3 px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe transition-all hover:bg-cream disabled:opacity-50"
                      >
                        Maybe
                      </button>
                      <button
                        onClick={() => rsvpMutation.mutate("going")}
                        disabled={rsvpMutation.isPending}
                        className="flex-1 rounded-full bg-cocoa py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                      >
                        {rsvpMutation.isPending ? "Saving…" : `Going · $${(event.price_cents / 100).toFixed(0)}`}
                      </button>
                    </div>
                  </div>
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
                      onClick={() => rsvpMutation.mutate("going")}
                      disabled={rsvpMutation.isPending}
                      className="flex-1 rounded-full bg-cocoa py-3.5 font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-background transition-all hover:opacity-90 disabled:opacity-50"
                    >
                      {rsvpMutation.isPending ? "Saving…" : `RSVP · $${(event.price_cents / 100).toFixed(0)}`}
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
      {/* ── PAYMENT TOGGLE CONFIRM ───────────────────────────────── */}
      {paymentToggleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-3xl bg-paper p-6 space-y-4">
            <h2 className="font-serif text-xl text-espresso">
              Mark {paymentToggleConfirm.guestName} as{" "}
              {paymentToggleConfirm.currentPaid ? "Not Paid" : "Paid"}?
            </h2>
            <p className="font-sans text-sm text-taupe leading-relaxed">
              {paymentToggleConfirm.currentPaid
                ? "This will revert their payment status. You can mark them paid again at any time."
                : "This manually marks this guest as having paid. Use this if payment was collected outside the app."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPaymentToggleConfirm(null)}
                className="flex-1 rounded-full border border-cream bg-paper py-3 font-sans text-sm font-medium text-cocoa transition-colors hover:bg-cream"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  markPaidMutation.mutate({
                    rsvpId: paymentToggleConfirm.rsvpId,
                    guestId: paymentToggleConfirm.guestId,
                    paid: !paymentToggleConfirm.currentPaid,
                  })
                }
                disabled={markPaidMutation.isPending}
                className="flex-1 rounded-full bg-cocoa py-3 font-sans text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {markPaidMutation.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SCOPE MODAL ─────────────────────────────────────── */}
      {showEditScopeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl bg-paper px-6 pt-6 pb-10 space-y-2">
            <h2 className="font-serif text-xl text-espresso mb-4">Edit recurring event</h2>
            <button
              onClick={() => {
                setShowEditScopeModal(false);
                navigate(`/create?edit=${id}`);
              }}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream"
            >
              <span className="font-sans text-sm font-semibold text-espresso">This event only</span>
              <span className="font-sans text-[12px] text-taupe">Only changes this one instance</span>
            </button>
            <button
              onClick={() => {
                setShowEditScopeModal(false);
                navigate(
                  `/create?edit=${parentEventId}&recurEditMode=future&fromDate=${encodeURIComponent(event.starts_at)}&redirectTo=${id}`
                );
              }}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream"
            >
              <span className="font-sans text-sm font-semibold text-espresso">
                This and all future events
              </span>
              <span className="font-sans text-[12px] text-taupe">
                Updates the series from here forward
              </span>
            </button>
            <button
              onClick={() => {
                setShowEditScopeModal(false);
                navigate(`/create?edit=${parentEventId}&recurEditMode=all&redirectTo=${id}`);
              }}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream"
            >
              <span className="font-sans text-sm font-semibold text-espresso">
                All events in series
              </span>
              <span className="font-sans text-[12px] text-taupe">
                Updates every event including past ones
              </span>
            </button>
            <button
              onClick={() => setShowEditScopeModal(false)}
              className="w-full py-3 font-sans text-sm text-taupe"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── CANCEL SCOPE MODAL ───────────────────────────────────── */}
      {showCancelScopeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-3xl bg-paper px-6 pt-6 pb-10 space-y-2">
            <h2 className="font-serif text-xl text-espresso mb-4">Cancel recurring event</h2>
            <button
              onClick={() => {
                setShowCancelScopeModal(false);
                setShowCancelConfirm(true);
              }}
              disabled={isCancellingRecurring}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream disabled:opacity-50"
            >
              <span className="font-sans text-sm font-semibold text-espresso">
                This event only
              </span>
              <span className="font-sans text-[12px] text-taupe">
                Cancels just this instance, series continues
              </span>
            </button>
            <button
              onClick={handleCancelFutureFrom}
              disabled={isCancellingRecurring}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-cream bg-paper px-4 py-4 text-left transition-colors hover:bg-cream disabled:opacity-50"
            >
              <span className="font-sans text-sm font-semibold text-espresso">
                This and all future events
              </span>
              <span className="font-sans text-[12px] text-taupe">
                {isCancellingRecurring ? "Cancelling…" : "Stops the series from this date forward"}
              </span>
            </button>
            <button
              onClick={handleCancelEntireSeries}
              disabled={isCancellingRecurring}
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-destructive/30 bg-paper px-4 py-4 text-left transition-colors hover:bg-destructive/5 disabled:opacity-50"
            >
              <span className="font-sans text-sm font-semibold text-destructive">
                Cancel entire series
              </span>
              <span className="font-sans text-[12px] text-taupe">
                {isCancellingRecurring ? "Cancelling…" : "Cancels all past and future events"}
              </span>
            </button>
            <button
              onClick={() => setShowCancelScopeModal(false)}
              disabled={isCancellingRecurring}
              className="w-full py-3 font-sans text-sm text-taupe"
            >
              Keep event
            </button>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ────────────────────────────────────────── */}
      {showPaymentSheet && !isFree && event.status !== "cancelled" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setShowPaymentSheet(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowPaymentSheet(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-cream"
            >
              <X className="h-3.5 w-3.5 text-cocoa" strokeWidth={2} />
            </button>

            {/* Header */}
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.25em] text-taupe mb-1">Complete Payment</p>
            <h3 className="font-serif text-xl text-espresso pr-8 mb-1">{event.title}</h3>
            <p className="font-sans text-sm text-taupe mb-6">
              ${(event.price_cents / 100).toFixed(0)} per guest
            </p>

            {/* Pay with Card — primary */}
            <button
              onClick={() => { setShowPaymentSheet(false); setShowCheckout(true); }}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-espresso py-4 mb-3 transition-opacity hover:opacity-90 active:scale-[0.99]"
            >
              <CreditCard className="h-5 w-5 text-background" strokeWidth={1.5} />
              <span className="font-sans text-[13px] font-semibold uppercase tracking-[0.2em] text-background">
                Pay with Card — ${(event.price_cents / 100).toFixed(0)}
              </span>
            </button>

            {/* Pay Another Way — secondary */}
            {(event as any).external_payment_link ? (
              <div className="rounded-2xl border border-cream bg-background p-4 space-y-2">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-taupe">Pay Another Way</p>
                <p className="font-sans text-xs text-cocoa leading-relaxed">
                  Send ${(event.price_cents / 100).toFixed(0)} to the host directly, then they'll confirm your payment.
                </p>
                <a
                  href={(event as any).external_payment_link.startsWith("http") ? (event as any).external_payment_link : `https://${(event as any).external_payment_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowPaymentSheet(false)}
                  className="flex items-center gap-1.5 font-sans text-sm font-semibold text-blush"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {(event as any).external_payment_link}
                </a>
              </div>
            ) : (
              <button
                onClick={() => setShowPaymentSheet(false)}
                className="w-full py-2.5 font-sans text-[12px] text-taupe text-center"
              >
                I'll pay another way
              </button>
            )}

            <p className="text-center font-sans text-[10px] text-taupe/70 mt-3">
              Your RSVP is saved. Tap the banner on the event page to pay later.
            </p>
          </div>
        </div>
      )}

      {/* ── HOST INVITE MODAL ─────────────────────────────────────── */}
      {showInviteSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setShowInviteSheet(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowInviteSheet(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-cream"
            >
              <X className="h-3.5 w-3.5 text-cocoa" strokeWidth={2} />
            </button>

            <h3 className="font-serif text-xl text-espresso mb-6 pr-8">Invite Guests</h3>

            <div className="space-y-3">
              {/* Share invite link */}
              <button
                onClick={async () => {
                  setShowInviteSheet(false);
                  const url = `${window.location.origin}/event/${id}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: event.title, text: `You're invited to ${event.title}`, url }); } catch {}
                  } else {
                    try { await navigator.clipboard.writeText(url); toast({ title: "Invite link copied!" }); } catch {}
                  }
                }}
                className="w-full flex items-center gap-4 rounded-2xl border border-cream bg-background p-4 text-left transition-colors hover:bg-cream active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cocoa/10">
                  <Share2 className="h-5 w-5 text-cocoa" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-sans text-sm font-semibold text-espresso">Share Invite Link</p>
                  <p className="font-sans text-xs text-taupe mt-0.5">Text, WhatsApp, email — any way you like</p>
                </div>
              </button>

              {/* Invite from members */}
              <button
                onClick={() => {
                  setShowInviteSheet(false);
                  setTab("guests");
                  setTimeout(() => setShowInviteMembers(true), 150);
                }}
                className="w-full flex items-center gap-4 rounded-2xl border border-cream bg-background p-4 text-left transition-colors hover:bg-cream active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush/20">
                  <Users className="h-5 w-5 text-blush" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-sans text-sm font-semibold text-espresso">Invite from Members</p>
                  <p className="font-sans text-xs text-taupe mt-0.5">Add existing Sonder Circle members</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
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
