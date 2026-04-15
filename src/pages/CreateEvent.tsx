import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Home, ImagePlus, Lock, UserCheck, Globe } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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

  const [title, setTitle] = useState("");
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

  if (!user) return <Navigate to="/welcome" replace />;

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
        toast({ title: "Event updated!" });
        navigate(`/event/${editId}`);
      } else {
        const { data, error } = await supabase
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
          })
          .select("id")
          .single();
        if (error) throw error;
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

        {/* Location */}
        <div className="space-y-2">
          <label className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-taupe">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
