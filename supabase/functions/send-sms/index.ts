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

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', '')
    )
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { to, message, idempotencyKey } = await req.json()

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Use E.164 (e.g., +15551234567)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check suppressed/opted-out — use service role for this
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if user has opted out of SMS
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, phone, phone_verified')
      .eq('phone', to)
      .maybeSingle()

    if (profile) {
      const { data: prefs } = await adminClient
        .from('notification_preferences')
        .select('sms_reminders, host_announcements_sms')
        .eq('user_id', profile.id)
        .maybeSingle()

      if (prefs && !prefs.sms_reminders && !prefs.host_announcements_sms) {
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: 'User opted out of SMS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Send SMS via Twilio gateway
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio API error:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: `Twilio error: ${data.message || response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, sid: data.sid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-sms error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
