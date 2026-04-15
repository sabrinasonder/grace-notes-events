import { createClient } from "npm:@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const appUrl = Deno.env.get("APP_URL") || "https://grace-notes-events.lovable.app"

Deno.serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find events happening within 46-50 hours from now (window to avoid duplicates with cron interval)
  const now = new Date()
  const windowStart = new Date(now.getTime() + 46 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 50 * 60 * 60 * 1000)

  // Get all favorites for events in the window
  const { data: favorites, error: favError } = await supabase
    .from("event_favorites")
    .select("user_id, event_id, events!inner(id, title, starts_at, capacity, status)")
    .gte("events.starts_at", windowStart.toISOString())
    .lte("events.starts_at", windowEnd.toISOString())
    .eq("events.status", "active")

  if (favError || !favorites?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } })
  }

  let sent = 0

  for (const fav of favorites) {
    const event = (fav as any).events
    const userId = fav.user_id
    const eventId = fav.event_id

    // Check if user already RSVP'd
    const { data: rsvp } = await supabase
      .from("rsvps")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle()

    if (rsvp) continue // Already RSVP'd (going, maybe, or declined)

    // Check capacity
    if (event.capacity != null) {
      const { count } = await supabase
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going")
      if (count != null && count >= event.capacity) continue
    }

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()

    if (!profile?.email) continue

    // Send reminder
    const idempotencyKey = `heart-reminder-${eventId}-${userId}`

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "heart-reminder",
        recipientEmail: profile.email,
        idempotencyKey,
        templateData: {
          eventTitle: event.title,
          eventDate: new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(event.starts_at)),
          eventUrl: `${appUrl}/event/${eventId}`,
        },
      },
    })

    sent++
  }

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } })
})
