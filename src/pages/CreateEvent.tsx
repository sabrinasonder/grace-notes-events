import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Camera, CalendarIcon, MapPin, Users, DollarSign, ChevronRight, Lock, UserCheck, Globe, UserPlus, X, Search, Repeat, Bell, ExternalLink } from "lucide-react";
import {
  type RecurrenceType,
  type MonthlyMode,
  buildRecurrenceRule,
  getRecurrenceDbType,
  describeRecurrence,
  computePreviewDates,
} from "@/lib/recurrence";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import type { Database } from "@/integrations/supabase/types";

type EventPrivacy = Database["public"]["Enums"]["event_privacy"];

const PRIVACY_OPTIONS: { value: EventPrivacy; label: string; desc: string; icon: typeof Lock }[] = [
  { value: "invite_only", label: "Invite Only", desc: "Only people you invite can see & join", icon: Lock },
  { value: "request_to_join", label: "Request to Join", desc: "Members can request — you approve", icon: UserCheck },
  { value: "open", label: "Open", desc: "Any member can see & RSVP", icon: Globe },
];

const CreateEvent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const recurEditMode = searchParams.get("recurEditMode"); // "future" | "all" | null
  const fromDate = searchParams.get("fromDate");

  const [title, setTitle] = useState("");
  // Recurrence (new events only)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [monthlyMode, setMonthlyMode] = useState<MonthlyMode>("same_day");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [externalPaymentLink, setExternalPaymentLink] = useState("");
  const [autoReminders, setAutoReminders] = useState(true);
  const [privacy, setPrivacy] = useState<EventPrivacy>("invite_only");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isAdjustingCover, setIsAdjustingCover] = useState(false);
  const adjustContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(!!editId);
  const [initialGuestIds, setInitialGuestIds] = useState<string[]>([]);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [cohostIds, setCohostIds] = useState<string[]>([]);
  const [removedCohostIds, setRemovedCohostIds] = useState<string[]>([]);
  const [existingCohosts, setExistingCohosts] = useState<{ id: string; user_id: string; full_name: string; avatar_url: string | null; role: string }[]>([]);
  const [showCohostPicker, setShowCohostPicker] = useState(false);
  const [cohostSearch, setCohostSearch] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateTimeOpen, setDateTimeOpen] = useState(false);

  const { data: allMembers = [] } = useQuery({
    queryKey: ["all_members_create"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      return data || [];
    },
    enabled: showGuestPicker || showCohostPicker,
  });

  useEffect(() => {
    if (!editId || !user) return;
    const loadEvent = async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", editId).single();
      if (error || !data) {
        toast({ title: "Event not found", variant: "destructive" });
        navigate("/");
        return;
      }
      if (data.host_id !== user.id) {
        toast({ title: "You can only edit your own events", variant: "destructive" });
        navigate(`/event/${editId}`);
        return;
      }
      setTitle(data.title);
      setDescription(data.description || "");
      setLocation(data.location || "");
      setCapacity(data.capacity ? String(data.capacity) : "");
      setPriceDollars(data.price_cents ? (data.price_cents / 100).toFixed(2) : "");
      setExternalPaymentLink((data as any).external_payment_link || "");
      setAutoReminders(data.auto_reminders_enabled);
      setPrivacy(data.privacy);
      const startsAt = new Date(data.starts_at);
      setDate(startsAt);
      setTime(format(startsAt, "HH:mm"));
      if (data.cover_image_url) setCoverPreview(data.cover_image_url);
      if ((data as any).cover_image_position) {
        const parts = (data as any).cover_image_position.split(" ");
        if (parts.length === 2) {
          setCoverPosition({ x: parseFloat(parts[0]), y: parseFloat(parts[1]) });
        }
      }
      // Load existing co-hosts
      const { data: hosts } = await (supabase as any)
        .from("event_hosts")
        .select("id, user_id, role, profiles!event_hosts_user_id_fkey(full_name, avatar_url)")
        .eq("event_id", editId);
      if (hosts) {
        setExistingCohosts(
          hosts.map((h: any) => ({
            id: h.id,
            user_id: h.user_id,
            full_name: h.profiles?.full_name || "Member",
            avatar_url: h.profiles?.avatar_url ?? null,
            role: h.role,
          }))
        );
      }
      setLoadingEvent(false);
    };
    loadEvent();
  }, [editId, user]);

  if (loading || loadingEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-serif text-2xl text-espresso">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/join" replace />;

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverPosition({ x: 50, y: 50 });
  };

  const handleAdjustPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't capture if the user tapped a button (e.g. Done)
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: coverPosition.x,
      posY: coverPosition.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleAdjustPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !adjustContainerRef.current) return;
    const rect = adjustContainerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    // Dragging right moves the image right → shows more of the left → decrease x
    const newX = Math.max(0, Math.min(100, dragStartRef.current.posX - (dx / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.posY - (dy / rect.height) * 100));
    setCoverPosition({ x: newX, y: newY });
  };

  const handleAdjustPointerUp = () => {
    dragStartRef.current = null;
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    if (!location.trim()) {
      toast({ title: "Please add a location", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const [hours, minutes] = time.split(":").map(Number);
      const startsAt = new Date(date);
      startsAt.setHours(hours, minutes, 0, 0);

      let coverUrl: string | null | undefined = undefined;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("event-images").upload(path, coverFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }

      const priceCents = priceDollars ? Math.round(parseFloat(priceDollars) * 100) : 0;
      const positionStr = `${coverPosition.x.toFixed(1)}% ${coverPosition.y.toFixed(1)}%`;
      const extLink = externalPaymentLink.trim() || null;

      if (editId) {
        const updatePayload = {
          title,
          description: description || null,
          starts_at: startsAt.toISOString(),
          location: location || null,
          capacity: capacity ? parseInt(capacity) : null,
          price_cents: priceCents,
          auto_reminders_enabled: autoReminders,
          privacy,
          external_payment_link: priceCents > 0 ? extLink : null,
          ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
          ...(coverPreview ? { cover_image_position: positionStr } : {}),
        };
        const { error } = await supabase.from("events").update(updatePayload).eq("id", editId);
        if (error) throw error;

        if (recurEditMode === "future" && fromDate) {
          // Delete all active instances from this date forward and regenerate
          await (supabase as any)
            .from("events")
            .delete()
            .eq("parent_event_id", editId)
            .gte("starts_at", fromDate)
            .eq("status", "active");
          (supabase as any).rpc("generate_recurring_instances");
        } else if (recurEditMode === "all") {
          // Propagate metadata changes to all existing instances
          const instancePayload = {
            title,
            description: description || null,
            location: location || null,
            capacity: capacity ? parseInt(capacity) : null,
            price_cents: priceCents,
            auto_reminders_enabled: autoReminders,
            privacy,
            ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
            ...(coverPreview ? { cover_image_position: positionStr } : {}),
          };
          await (supabase as any)
            .from("events")
            .update(instancePayload)
            .eq("parent_event_id", editId);
        }

        // Apply co-host changes
        if (removedCohostIds.length > 0) {
          await (supabase as any)
            .from("event_hosts")
            .delete()
            .eq("event_id", editId)
            .in("user_id", removedCohostIds);
        }
        if (cohostIds.length > 0) {
          await (supabase as any).from("event_hosts").insert(
            cohostIds.map((uid) => ({
              event_id: editId,
              user_id: uid,
              role: "co-host",
              added_by: user.id,
            }))
          );
        }

        toast({ title: "Event updated!" });
        const redirectTo = searchParams.get("redirectTo") || editId;
        navigate(`/event/${redirectTo}`);
      } else {
        // Build recurrence payload for new recurring events
        const isRecurring = recurrenceType !== "none";
        const recurrencePayload = isRecurring
          ? {
              recurrence_type: getRecurrenceDbType(recurrenceType, monthlyMode),
              recurrence_rule: buildRecurrenceRule(startsAt, recurrenceType, monthlyMode),
              recurrence_end_date: recurrenceEndDate
                ? format(recurrenceEndDate, "yyyy-MM-dd")
                : null,
              is_recurring_parent: true,
            }
          : {};

        const { data, error } = await (supabase as any)
          .from("events")
          .insert({
            host_id: user.id,
            title,
            description: description || null,
            cover_image_url: coverUrl ?? null,
            cover_image_position: positionStr,
            starts_at: startsAt.toISOString(),
            location: location || null,
            capacity: capacity ? parseInt(capacity) : null,
            price_cents: priceCents,
            external_payment_link: priceCents > 0 ? extLink : null,
            auto_reminders_enabled: autoReminders,
            privacy,
            ...recurrencePayload,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (isRecurring) {
          // Fire and forget — generates next 3 months of instances
          (supabase as any).rpc("generate_recurring_instances");
        }

        if (cohostIds.length > 0) {
          await (supabase as any).from("event_hosts").insert(
            cohostIds.map((uid) => ({
              event_id: data.id,
              user_id: uid,
              role: "co-host",
              added_by: user.id,
            }))
          );
        }
        if (initialGuestIds.length > 0) {
          await supabase.from("event_invites").insert(
            initialGuestIds.map((memberId) => ({
              event_id: data.id,
              invited_user_id: memberId,
              invited_by: user.id,
            }))
          );
        }
        toast({ title: "Event created!" });
        navigate(`/event/${data.id}`);
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-cream">
        <div className="mx-auto flex max-w-lg items-center px-5 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center"
          >
            <X className="h-5 w-5 text-cocoa" strokeWidth={1.5} />
          </button>
          <h1 className="flex-1 text-center font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-espresso">
            {editId ? "Edit Event" : "New Event"}
          </h1>
          <button
            form="event-form"
            type="submit"
            disabled={submitting || !title}
            className="rounded-full bg-espresso px-5 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background disabled:opacity-40 transition-opacity"
          >
            {submitting ? "…" : editId ? "Save" : "Publish"}
          </button>
        </div>
      </div>

      <form id="event-form" onSubmit={handleSubmit} className="mx-auto max-w-lg pb-20">

        {/* ── TITLE ── */}
        <div className="px-6 pt-6 pb-5 border-b border-cream">
          <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-2">Title</p>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your gathering"
            className="w-full bg-transparent font-serif text-[28px] font-light leading-tight text-espresso placeholder:text-[#9faab8] focus:outline-none"
          />
        </div>

        {/* ── COVER IMAGE ── */}
        <div className="px-5 pt-5 pb-2">
          {coverPreview ? (
            <div
              ref={adjustContainerRef}
              className="relative h-52 rounded-2xl overflow-hidden"
              style={{ cursor: isAdjustingCover ? "grab" : undefined, touchAction: isAdjustingCover ? "none" : undefined }}
              onPointerDown={isAdjustingCover ? handleAdjustPointerDown : undefined}
              onPointerMove={isAdjustingCover ? handleAdjustPointerMove : undefined}
              onPointerUp={isAdjustingCover ? handleAdjustPointerUp : undefined}
              onPointerCancel={isAdjustingCover ? handleAdjustPointerUp : undefined}
            >
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-full w-full object-cover pointer-events-none select-none"
                style={{ objectPosition: `${coverPosition.x}% ${coverPosition.y}%` }}
                draggable={false}
              />
              {isAdjustingCover ? (
                <div className="absolute inset-0 flex flex-col items-center justify-between py-4 pointer-events-none">
                  <div className="rounded-full bg-black/50 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
                    Drag to reposition
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-white/90 px-5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa shadow"
                    onClick={() => setIsAdjustingCover(false)}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <label className="cursor-pointer rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5">
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                    <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-white">Change</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAdjustingCover(true)}
                    className="rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                  >
                    Reposition
                  </button>
                </div>
              )}
            </div>
          ) : (
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              <div className="flex h-44 items-center justify-center rounded-2xl bg-cream/60">
                <div className="text-center space-y-2.5">
                  <Camera className="mx-auto h-6 w-6 text-taupe/50" strokeWidth={1.5} />
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60">
                    Add Cover
                  </p>
                </div>
              </div>
            </label>
          )}
        </div>

        {/* ── DATE & TIME ── */}
        <div className="border-b border-cream">
          <button
            type="button"
            onClick={() => setDateTimeOpen(!dateTimeOpen)}
            className="flex w-full items-center gap-4 px-6 py-4 transition-colors active:bg-cream/40"
          >
            <CalendarIcon className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
            <div className="flex-1 text-left">
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60">Date &amp; Time</p>
              <p className={cn("font-sans text-[15px] font-semibold mt-0.5", date ? "text-espresso" : "text-cocoa")}>
                {date ? `${format(date, "EEE, MMM d, yyyy")} · ${formatTime(time)}` : "Choose…"}
              </p>
            </div>
            <ChevronRight
              className={cn("h-4 w-4 text-taupe/40 transition-transform duration-200", dateTimeOpen && "rotate-90")}
              strokeWidth={1.5}
            />
          </button>
          {dateTimeOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-cream/50">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => setDate(d)}
                initialFocus
                className="pointer-events-auto mx-auto"
              />
              <div className="flex items-center gap-4 px-1">
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 w-8 shrink-0">
                  Time
                </span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 rounded-xl bg-cream/60 px-4 py-2.5 font-sans text-sm text-espresso focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setDateTimeOpen(false)}
                className="w-full rounded-full bg-espresso py-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* ── REPEATS — only after date is picked, new events only ── */}
        {!editId && date && (
          <div className="border-b border-cream px-6 py-4 space-y-3">
            <div className="flex items-center gap-4">
              <Repeat className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60">Repeats</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-[34px]">
              {(
                [
                  { value: "none", label: "Does not repeat" },
                  { value: "weekly", label: "Every week" },
                  { value: "biweekly", label: "Every 2 weeks" },
                  { value: "monthly", label: "Every month" },
                ] as { value: RecurrenceType; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecurrenceType(value)}
                  className={cn(
                    "rounded-full border px-3 py-2 font-sans text-[11px] font-semibold transition-all text-center",
                    recurrenceType === value
                      ? "border-espresso bg-espresso text-background"
                      : "border-cream bg-paper text-cocoa hover:border-taupe/40"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {recurrenceType === "monthly" && (
              <div className="space-y-2 pl-[34px]">
                {(
                  [
                    { value: "same_day", label: describeRecurrence(date, "monthly", "same_day") },
                    { value: "same_date", label: describeRecurrence(date, "monthly", "same_date") },
                  ] as { value: MonthlyMode; label: string }[]
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMonthlyMode(value)}
                    className={cn(
                      "flex items-center gap-2.5 w-full rounded-full border px-3 py-2 font-sans text-[11px] font-semibold transition-all",
                      monthlyMode === value
                        ? "border-espresso bg-espresso text-background"
                        : "border-cream bg-paper text-cocoa"
                    )}
                  >
                    <div className={cn("h-3 w-3 shrink-0 rounded-full border-2", monthlyMode === value ? "border-background bg-background" : "border-taupe/40")} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(recurrenceType === "weekly" || recurrenceType === "biweekly") && (
              <p className="font-serif italic text-[13px] text-cocoa pl-[34px]">
                {describeRecurrence(date, recurrenceType, monthlyMode)}
              </p>
            )}

            {recurrenceType !== "none" && (
              <div className="flex items-center gap-3 pl-[34px]">
                <span className="font-sans text-[11px] text-taupe/70 shrink-0">Ends:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 text-left font-sans text-[13px] underline-offset-2 hover:underline",
                        recurrenceEndDate ? "text-espresso" : "text-taupe/50"
                      )}
                    >
                      {recurrenceEndDate ? format(recurrenceEndDate, "MMM d, yyyy") : "Ongoing"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                    <Calendar
                      mode="single"
                      selected={recurrenceEndDate}
                      onSelect={setRecurrenceEndDate}
                      disabled={(d) => (date ? d <= date : false)}
                      className="pointer-events-auto p-3"
                    />
                    {recurrenceEndDate && (
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndDate(undefined)}
                        className="w-full py-2.5 font-sans text-[11px] text-taupe border-t border-cream hover:text-destructive transition-colors"
                      >
                        Clear — ongoing
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {recurrenceType !== "none" && (() => {
              const previews = computePreviewDates(date, recurrenceType, monthlyMode, recurrenceEndDate, 3);
              return previews.length > 0 ? (
                <p className="font-sans text-[12px] text-taupe/70 pl-[34px]">
                  Next: {previews.map((d) => format(d, "MMM d")).join(" · ")}
                </p>
              ) : null;
            })()}
          </div>
        )}

        {/* ── LOCATION ── */}
        <div className="flex items-start gap-4 border-b border-cream px-6 py-4">
          <MapPin className="h-[18px] w-[18px] shrink-0 text-blush mt-[18px]" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-0.5">Location</p>
            <PlacesAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Add address"
              className="w-full bg-transparent font-sans text-[15px] font-semibold text-espresso placeholder:text-cocoa placeholder:font-semibold focus:outline-none border-none"
            />
          </div>
          <ChevronRight className="h-4 w-4 text-taupe/40 shrink-0 mt-[18px]" strokeWidth={1.5} />
        </div>

        {/* ── CAPACITY ── */}
        <div className="flex items-center gap-4 border-b border-cream px-6 py-4">
          <Users className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-0.5">Capacity</p>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className="w-full bg-transparent font-sans text-[15px] font-semibold text-espresso placeholder:text-cocoa placeholder:font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <ChevronRight className="h-4 w-4 text-taupe/40 shrink-0" strokeWidth={1.5} />
        </div>

        {/* ── PRICE ── */}
        <div className="flex items-center gap-4 border-b border-cream px-6 py-4">
          <DollarSign className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-0.5">Price Per Guest</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="Free"
              className="w-full bg-transparent font-sans text-[15px] font-semibold text-espresso placeholder:text-cocoa placeholder:font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <ChevronRight className="h-4 w-4 text-taupe/40 shrink-0" strokeWidth={1.5} />
        </div>

        {/* ── EXTERNAL PAYMENT LINK (only when price is set) ── */}
        {priceDollars && parseFloat(priceDollars) > 0 && (
          <div className="flex items-center gap-4 border-b border-cream px-6 py-4">
            <ExternalLink className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-0.5">
                Alternative Payment Link <span className="normal-case tracking-normal font-normal">(optional)</span>
              </p>
              <input
                type="text"
                value={externalPaymentLink}
                onChange={(e) => setExternalPaymentLink(e.target.value)}
                placeholder="venmo.com/yourname or Cash App $tag"
                className="w-full bg-transparent font-sans text-[15px] font-semibold text-espresso placeholder:text-cocoa placeholder:font-semibold focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ── DESCRIPTION ── */}
        <div className="border-b border-cream px-6 py-4">
          <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-2">Description</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Set the tone — what should guests expect?"
            className="w-full bg-transparent font-serif italic text-[15px] text-cocoa placeholder:text-taupe/30 placeholder:not-italic focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* ── PRIVACY ── */}
        <div className="border-b border-cream px-6 py-5 space-y-2">
          <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60 mb-3">Privacy</p>
          {PRIVACY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = privacy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrivacy(opt.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                  selected
                    ? "border-espresso/25 bg-espresso/5"
                    : "border-cream bg-paper hover:border-taupe/25"
                )}
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", selected ? "text-espresso" : "text-taupe")}
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-sans text-sm font-medium", selected ? "text-espresso" : "text-cocoa")}>
                    {opt.label}
                  </p>
                  <p className="font-sans text-[11px] text-taupe">{opt.desc}</p>
                </div>
                <div
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center",
                    selected ? "border-espresso bg-espresso" : "border-taupe/30"
                  )}
                >
                  {selected && <div className="h-1.5 w-1.5 rounded-full bg-background" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── AUTO-REMINDERS ── */}
        <div className="flex items-center gap-4 border-b border-cream px-6 py-4">
          <Bell className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="font-sans text-[14px] font-medium text-espresso">Auto-reminders</p>
            <p className="font-sans text-[11px] text-taupe">Send 48h &amp; 24h reminders to guests</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoReminders(!autoReminders)}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors shrink-0",
              autoReminders ? "bg-espresso" : "bg-cream"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-background shadow-sm transition-all",
                autoReminders ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>

        {/* ── CO-HOSTS ── */}
        <div className="border-b border-cream px-6 py-4 space-y-3">
          <div className="flex items-center gap-4">
            <UserPlus className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60">Co-hosts</p>
              <p className="font-sans text-[11px] text-taupe">Full hosting permissions</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCohostPicker(!showCohostPicker)}
              className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-espresso transition-colors"
            >
              {showCohostPicker ? "Close" : "+ Add"}
            </button>
          </div>

          {(existingCohosts.filter((h) => !removedCohostIds.includes(h.user_id)).length > 0 || cohostIds.length > 0) && (
            <div className="flex flex-wrap gap-2 pl-[34px]">
              {existingCohosts
                .filter((h) => !removedCohostIds.includes(h.user_id))
                .map((h) => (
                  <span
                    key={h.user_id}
                    className="flex items-center gap-1.5 rounded-full bg-espresso/10 px-3 py-1.5 font-sans text-[11px] text-espresso"
                  >
                    {h.full_name}
                    {h.role !== "creator" && (
                      <button
                        type="button"
                        onClick={() => setRemovedCohostIds((ids) => [...ids, h.user_id])}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </span>
                ))}
              {cohostIds.map((uid) => {
                const m = allMembers.find((m: any) => m.id === uid);
                return (
                  <span
                    key={uid}
                    className="flex items-center gap-1.5 rounded-full bg-espresso/10 px-3 py-1.5 font-sans text-[11px] text-espresso"
                  >
                    {m?.full_name || "Member"}
                    <button
                      type="button"
                      onClick={() => setCohostIds((ids) => ids.filter((i) => i !== uid))}
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {showCohostPicker && (
            <div className="pl-[34px] space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe/60" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Search members…"
                  value={cohostSearch}
                  onChange={(e) => setCohostSearch(e.target.value)}
                  className="w-full rounded-full border border-cream bg-paper py-2.5 pl-9 pr-4 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-xl border border-cream bg-paper p-1">
                {allMembers
                  .filter((m: any) => {
                    if (m.id === user?.id) return false;
                    if (cohostIds.includes(m.id)) return false;
                    if (existingCohosts.some((h) => h.user_id === m.id && !removedCohostIds.includes(m.id))) return false;
                    if (!cohostSearch.trim()) return true;
                    return (m.full_name || "").toLowerCase().includes(cohostSearch.toLowerCase());
                  })
                  .map((m: any) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setCohostIds((ids) => [...ids, m.id]);
                        setCohostSearch("");
                        setShowCohostPicker(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-cream transition-colors text-left"
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[11px] text-espresso">
                          {(m.full_name || "?")[0]}
                        </div>
                      )}
                      <span className="text-sm font-sans text-espresso">{m.full_name || "Member"}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── ADD GUESTS (new events only) ── */}
        {!editId && (
          <div className="border-b border-cream px-6 py-4 space-y-3">
            <div className="flex items-center gap-4">
              <Users className="h-[18px] w-[18px] shrink-0 text-blush" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.3em] text-taupe/60">Add Guests</p>
                <p className="font-sans text-[11px] text-taupe">Notify members at creation — optional</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuestPicker(!showGuestPicker)}
                className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-taupe hover:text-espresso transition-colors"
              >
                {showGuestPicker ? "Close" : "+ Add"}
              </button>
            </div>

            {initialGuestIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-[34px]">
                {initialGuestIds.map((gid) => {
                  const m = allMembers.find((m: any) => m.id === gid);
                  return (
                    <span
                      key={gid}
                      className="flex items-center gap-1.5 rounded-full bg-espresso/10 px-3 py-1.5 font-sans text-[11px] text-espresso"
                    >
                      {m?.full_name || "Member"}
                      <button
                        type="button"
                        onClick={() => setInitialGuestIds((ids) => ids.filter((i) => i !== gid))}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {showGuestPicker && (
              <div className="pl-[34px] space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe/60" strokeWidth={1.5} />
                  <input
                    type="text"
                    placeholder="Search members…"
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    className="w-full rounded-full border border-cream bg-paper py-2.5 pl-9 pr-4 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-cream bg-paper p-1">
                  {allMembers
                    .filter((m: any) => {
                      if (m.id === user?.id) return false;
                      if (initialGuestIds.includes(m.id)) return false;
                      if (!guestSearch.trim()) return true;
                      return (m.full_name || "").toLowerCase().includes(guestSearch.toLowerCase());
                    })
                    .map((m: any) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setInitialGuestIds((ids) => [...ids, m.id]);
                          setGuestSearch("");
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-cream transition-colors text-left"
                      >
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-blush/30 flex items-center justify-center font-serif text-[11px] text-espresso">
                            {(m.full_name || "?")[0]}
                          </div>
                        )}
                        <span className="text-sm font-sans text-espresso">{m.full_name || "Member"}</span>
                      </button>
                    ))}
                  {allMembers.filter(
                    (m: any) =>
                      m.id !== user?.id &&
                      !initialGuestIds.includes(m.id) &&
                      (!guestSearch.trim() || (m.full_name || "").toLowerCase().includes(guestSearch.toLowerCase()))
                  ).length === 0 && (
                    <p className="text-sm font-sans text-taupe text-center py-3">
                      {guestSearch ? "No matches" : "No other members yet"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </form>
    </div>
  );
};

export default CreateEvent;
