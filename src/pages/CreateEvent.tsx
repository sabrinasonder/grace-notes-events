import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Home, ImagePlus, Lock, UserCheck, Globe, UserPlus, X, Search, Repeat } from "lucide-react";
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
  const [autoReminders, setAutoReminders] = useState(true);
  const [privacy, setPrivacy] = useState<EventPrivacy>("invite_only");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(!!editId);
  const [initialGuestIds, setInitialGuestIds] = useState<string[]>([]);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");

  const { data: allMembers = [] } = useQuery({
    queryKey: ["all_members_create"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      return data || [];
    },
    enabled: showGuestPicker,
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
      setAutoReminders(data.auto_reminders_enabled);
      setPrivacy(data.privacy);
      const startsAt = new Date(data.starts_at);
      setDate(startsAt);
      setTime(format(startsAt, "HH:mm"));
      if (data.cover_image_url) setCoverPreview(data.cover_image_url);
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
          ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
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
          (supabase as any).rpc("generate_recurring_instances").catch(() => {});
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
          };
          await (supabase as any)
            .from("events")
            .update(instancePayload)
            .eq("parent_event_id", editId);
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
            starts_at: startsAt.toISOString(),
            location: location || null,
            capacity: capacity ? parseInt(capacity) : null,
            price_cents: priceCents,
            auto_reminders_enabled: autoReminders,
            privacy,
            ...recurrencePayload,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (isRecurring) {
          // Fire and forget — generates next 3 months of instances
          (supabase as any).rpc("generate_recurring_instances").catch(() => {});
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
    <div className="min-h-screen bg-background pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-cream bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <ArrowLeft className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-center font-serif text-lg text-espresso">
            {editId ? "Edit Event" : "Create Event"}
          </h1>
          <button
            onClick={() => navigate("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream transition-colors hover:bg-cream/80"
          >
            <Home className="h-4 w-4 text-cocoa" strokeWidth={2} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg px-6 pt-8 space-y-7">
        {/* Cover image */}
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
          {coverPreview ? (
            <div className="relative h-52 rounded-2xl overflow-hidden">
              <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <span className="rounded-full bg-white/80 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa backdrop-blur-sm">
                  Change Photo
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center rounded-2xl border-2 border-dashed border-cream bg-paper">
              <div className="text-center space-y-2">
                <ImagePlus className="mx-auto h-8 w-8 text-taupe/50" strokeWidth={1.5} />
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
                  Add Cover Photo
                </p>
              </div>
            </div>
          )}
        </label>

        {/* Title */}
        <div className="space-y-2">
          <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Event Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full Moon Dinner"
            className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 font-serif text-lg text-espresso placeholder:text-taupe/40 focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's this gathering about?"
            className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 font-serif italic text-sm text-cocoa placeholder:text-taupe/40 placeholder:not-italic focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors resize-none leading-relaxed"
          />
        </div>

        {/* Privacy selector */}
        <div className="space-y-2">
          <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Privacy</label>
          <div className="space-y-2">
            {PRIVACY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = privacy === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrivacy(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                    selected
                      ? "border-cocoa bg-cocoa/5"
                      : "border-cream bg-paper hover:border-taupe/30"
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", selected ? "text-cocoa" : "text-taupe")}
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <p className={cn("font-sans text-sm font-medium", selected ? "text-espresso" : "text-cocoa")}>
                      {opt.label}
                    </p>
                    <p className="font-sans text-[11px] text-taupe">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                      selected ? "border-cocoa bg-cocoa" : "border-taupe/40"
                    )}
                  >
                    {selected && (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-background" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-xl border border-cream bg-paper px-4 py-3.5 text-left text-sm font-sans transition-colors",
                    date ? "text-espresso" : "text-taupe/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-blush" strokeWidth={1.5} />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 text-sm font-sans text-espresso focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
            />
          </div>
        </div>

        {/* Repeats (new events only) */}
        {!editId && (
          <div className="space-y-3">
            <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe flex items-center gap-1.5">
              <Repeat className="h-3 w-3" strokeWidth={1.5} />
              Repeats
            </label>

            {/* Frequency options */}
            <div className="grid grid-cols-2 gap-2">
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
                    "rounded-xl border px-3 py-2.5 text-left font-sans text-sm transition-all",
                    recurrenceType === value
                      ? "border-cocoa bg-cocoa/5 text-espresso"
                      : "border-cream bg-paper text-cocoa hover:border-taupe/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Monthly sub-option */}
            {recurrenceType === "monthly" && date && (
              <div className="space-y-2 pl-1">
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
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 w-full font-sans text-sm transition-all",
                      monthlyMode === value
                        ? "border-cocoa bg-cocoa/5 text-espresso"
                        : "border-cream bg-paper text-cocoa hover:border-taupe/30"
                    )}
                  >
                    <div
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                        monthlyMode === value ? "border-cocoa bg-cocoa" : "border-taupe/40"
                      )}
                    />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Confirmation text for weekly / biweekly */}
            {(recurrenceType === "weekly" || recurrenceType === "biweekly") && date && (
              <p className="font-serif italic text-[13px] text-cocoa pl-1">
                {describeRecurrence(date, recurrenceType, monthlyMode)}
              </p>
            )}

            {/* End date picker */}
            {recurrenceType !== "none" && (
              <div className="flex items-center gap-3">
                <span className="font-sans text-[11px] text-taupe shrink-0">Ends:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 rounded-xl border border-cream bg-paper px-3 py-2.5 font-sans text-sm text-left transition-colors",
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
                      disabled={(d) => date ? d <= date : false}
                      className="pointer-events-auto p-3"
                    />
                    {recurrenceEndDate && (
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndDate(undefined)}
                        className="w-full py-2.5 font-sans text-[11px] text-taupe border-t border-cream hover:text-destructive transition-colors"
                      >
                        Clear — set ongoing
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Preview: next 3 dates */}
            {recurrenceType !== "none" && date && (() => {
              const previews = computePreviewDates(date, recurrenceType, monthlyMode, recurrenceEndDate, 3);
              return (
                <div className="rounded-xl bg-paper border border-cream px-4 py-3 space-y-1">
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.22em] text-taupe">
                    Upcoming
                  </p>
                  {previews.length > 0 ? (
                    <p className="font-sans text-[13px] text-cocoa">
                      {previews.map((d) => format(d, "MMM d")).join(" · ")}
                    </p>
                  ) : (
                    <p className="font-sans text-[12px] italic text-taupe/60">
                      No upcoming dates within the end date
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Location */}
        <div className="space-y-2">
          <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Location</label>
          <PlacesAutocomplete
            value={location}
            onChange={setLocation}
            placeholder="e.g. The Loft, 123 Main St"
            className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 text-sm font-sans text-espresso placeholder:text-taupe/40 focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
          />
        </div>

        {/* Capacity + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Capacity</label>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 text-sm font-sans text-espresso placeholder:text-taupe/40 focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Price ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="0 = Free"
              className="w-full rounded-xl border border-cream bg-paper px-4 py-3.5 text-sm font-sans text-espresso placeholder:text-taupe/40 focus:border-cocoa focus:outline-none focus:ring-1 focus:ring-cocoa transition-colors"
            />
          </div>
        </div>

        {/* Auto-reminders toggle */}
        <div className="flex items-center justify-between border-b border-cream pb-5">
          <div className="space-y-0.5">
            <p className="font-sans text-sm font-medium text-espresso">Auto-reminders</p>
            <p className="font-sans text-[11px] text-taupe">Send 48h & 24h reminders to guests</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoReminders(!autoReminders)}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              autoReminders ? "bg-cocoa" : "bg-cream"
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

        {/* Initial guests (new events only) */}
        {!editId && (
          <div className="space-y-3 border-b border-cream pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Add Guests</p>
                <p className="font-sans text-[10px] text-taupe mt-0.5">Notify app members at creation — optional</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuestPicker(!showGuestPicker)}
                className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-cocoa transition-colors hover:bg-cream/80"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                {showGuestPicker ? "Close" : "Add"}
              </button>
            </div>

            {initialGuestIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {initialGuestIds.map((gid) => {
                  const m = allMembers.find((m: any) => m.id === gid);
                  return (
                    <span key={gid} className="flex items-center gap-1.5 rounded-full bg-cocoa/10 px-3 py-1 font-sans text-[10px] font-semibold text-cocoa">
                      {m?.full_name || "Member"}
                      <button type="button" onClick={() => setInitialGuestIds((ids) => ids.filter((i) => i !== gid))}>
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {showGuestPicker && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-taupe" strokeWidth={1.5} />
                  <input
                    type="text"
                    placeholder="Search members…"
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    className="w-full rounded-full border border-cream bg-paper py-2.5 pl-9 pr-4 text-sm font-sans text-espresso placeholder:text-taupe focus:outline-none focus:ring-1 focus:ring-cocoa"
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
                        onClick={() => { setInitialGuestIds((ids) => [...ids, m.id]); setGuestSearch(""); }}
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
                  {allMembers.filter((m: any) => m.id !== user?.id && !initialGuestIds.includes(m.id) && (!guestSearch.trim() || (m.full_name || "").toLowerCase().includes(guestSearch.toLowerCase()))).length === 0 && (
                    <p className="text-sm font-sans text-taupe text-center py-3">{guestSearch ? "No matches" : "No other members yet"}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title}
          className="w-full rounded-full bg-cocoa py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
        >
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-background">
            {submitting
              ? editId ? "Saving…" : "Creating…"
              : editId ? "Save Changes" : "Create Event"}
          </span>
        </button>
      </form>
    </div>
  );
};

export default CreateEvent;
