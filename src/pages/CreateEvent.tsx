import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Home, ImagePlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(!!editId);

  // Load existing event data when editing
  useEffect(() => {
    if (!editId || !user) return;

    const loadEvent = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", editId)
        .single();

      if (error || !data) {
        toast({ title: "Event not found", variant: "destructive" });
        navigate("/");
        return;
      }

      // Only the host can edit
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

      const startsAt = new Date(data.starts_at);
      setDate(startsAt);
      setTime(format(startsAt, "HH:mm"));

      if (data.cover_image_url) {
        setCoverPreview(data.cover_image_url);
      }

      setLoadingEvent(false);
    };

    loadEvent();
  }, [editId, user]);

  if (loading || loadingEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse font-display text-2xl text-foreground">Loading…</div>
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
      // Combine date + time
      const [hours, minutes] = time.split(":").map(Number);
      const startsAt = new Date(date);
      startsAt.setHours(hours, minutes, 0, 0);

      // Upload cover image if a new file was selected
      let coverUrl: string | null | undefined = undefined;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(path, coverFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("event-images")
          .getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }

      const priceCents = priceDollars
        ? Math.round(parseFloat(priceDollars) * 100)
        : 0;

      if (editId) {
        // Update existing event
        const updatePayload = {
          title,
          description: description || null,
          starts_at: startsAt.toISOString(),
          location: location || null,
          capacity: capacity ? parseInt(capacity) : null,
          price_cents: priceCents,
          auto_reminders_enabled: autoReminders,
          ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
        };

        const { error } = await supabase
          .from("events")
          .update(updatePayload)
          .eq("id", editId);

        if (error) throw error;

        toast({ title: "Event updated!" });
        navigate(`/event/${editId}`);
      } else {
        // Create new event
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
          })
          .select("id")
          .single();

        if (error) throw error;

        toast({ title: "Event created!" });
        navigate(`/event/${data.id}`);
      }
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center px-5 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            <span className="label-meta">Back</span>
          </button>
          <h1 className="flex-1 text-center font-display text-lg text-foreground">
            {editId ? "Edit Event" : "Create Event"}
          </h1>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg px-5 pt-6 space-y-6">
        {/* Cover image */}
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="hidden"
          />
          {coverPreview ? (
            <div className="relative h-48 rounded-3xl overflow-hidden">
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                <span className="pill-tag bg-background/80 text-foreground">
                  Change Photo
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card">
              <div className="text-center space-y-2">
                <ImagePlus
                  className="mx-auto h-8 w-8 text-muted-foreground/50"
                  strokeWidth={1.5}
                />
                <p className="label-meta text-muted-foreground">
                  Add Cover Photo
                </p>
              </div>
            </div>
          )}
        </label>

        {/* Title */}
        <div className="space-y-2">
          <label className="label-meta text-muted-foreground">
            Event Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full Moon Dinner"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 font-display text-lg text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="label-meta text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's this gathering about?"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="label-meta text-muted-foreground">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors",
                    date ? "text-foreground" : "text-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
            <label className="label-meta text-muted-foreground">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="label-meta text-muted-foreground">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. The Loft, 123 Main St"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        {/* Capacity + Price */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="label-meta text-muted-foreground">
              Capacity
            </label>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="label-meta text-muted-foreground">
              Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="0 = Free"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        {/* Auto-reminders toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Auto-reminders
            </p>
            <p className="text-xs text-muted-foreground">
              Send 48h & 24h reminders to guests
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoReminders(!autoReminders)}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              autoReminders ? "bg-primary" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-primary-foreground shadow transition-transform",
                autoReminders ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !title}
          className="w-full rounded-full bg-primary py-3.5 transition-all hover:opacity-90 disabled:opacity-50"
        >
          <span className="label-meta text-primary-foreground">
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
