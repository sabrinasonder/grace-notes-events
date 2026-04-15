import { createClient } from 'npm:@supabase/supabase-js@2'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_PHONE_NUMBER) {
      throw new Error('Missing Twilio configuration')
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()

    // ── 1. 48-hour reminders ──
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const in47h = new Date(now.getTime() + 47 * 60 * 60 * 1000)

    const { data: upcoming48h } = await adminClient
      .from('events')
      .select('id, title, starts_at, location')
      .gte('starts_at', in47h.toISOString())
      .lte('starts_at', in48h.toISOString())

    for (const event of upcoming48h || []) {
      const { data: rsvps } = await adminClient
        .from('rsvps')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('status', 'going')

      for (const rsvp of rsvps || []) {
        await sendEventSms(
          adminClient,
          rsvp.user_id,
          `Reminder: ${event.title} is in 2 days at ${formatTime(event.starts_at)}. See you there! Reply STOP to opt out.`,
          'sms_reminders',
          LOVABLE_API_KEY,
          TWILIO_API_KEY,
          TWILIO_PHONE_NUMBER
        )
      }
    }

    // ── 2. Morning-of reminders (events starting today, sent at ~8am) ──
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // Only run morning-of if current hour is 8 (cron runs hourly)
    if (now.getUTCHours() >= 12 && now.getUTCHours() <= 14) {
      const { data: todayEvents } = await adminClient
        .from('events')
        .select('id, title, starts_at, location')
        .gte('starts_at', todayStart.toISOString())
        .lte('starts_at', todayEnd.toISOString())

      for (const event of todayEvents || []) {
        const { data: rsvps } = await adminClient
          .from('rsvps')
          .select('user_id')
          .eq('event_id', event.id)
          .eq('status', 'going')

        const locationPart = event.location ? `, ${event.location}` : ''
        for (const rsvp of rsvps || []) {
          await sendEventSms(
            adminClient,
            rsvp.user_id,
            `Today's the day! ${event.title} at ${formatTime(event.starts_at)}${locationPart}. Reply STOP to opt out.`,
            'sms_reminders',
            LOVABLE_API_KEY,
            TWILIO_API_KEY,
            TWILIO_PHONE_NUMBER
          )
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('sms-reminders error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function formatTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

async function sendEventSms(
  adminClient: any,
  userId: string,
  message: string,
  prefField: 'sms_reminders' | 'host_announcements_sms',
  lovableApiKey: string,
  twilioApiKey: string,
  fromNumber: string
) {
  // Get user profile with phone
  const { data: profile } = await adminClient
    .from('profiles')
    .select('phone, phone_verified')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.phone || !profile?.phone_verified) return

  // Check notification preferences
  const { data: prefs } = await adminClient
    .from('notification_preferences')
    .select(prefField)
    .eq('user_id', userId)
    .maybeSingle()

  // Default is ON, so only skip if explicitly false
  if (prefs && prefs[prefField] === false) return

  const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': twilioApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: profile.phone,
        From: fromNumber,
        Body: message,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error(`SMS to ${profile.phone} failed:`, data)
    }
  } catch (err) {
    console.error(`SMS send error for ${userId}:`, err)
  }
}
