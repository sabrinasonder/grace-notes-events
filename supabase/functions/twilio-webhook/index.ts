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

    // This webhook receives inbound SMS from Twilio
    // Parse as form-urlencoded (Twilio sends this format)
    const formData = await req.formData()
    const body = formData.get('Body')?.toString().trim().toUpperCase() || ''
    const from = formData.get('From')?.toString() || ''

    if (!from) {
      return new Response('<Response></Response>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (body === 'STOP' || body === 'UNSUBSCRIBE') {
      // Find user by phone number and disable SMS
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', from)
        .maybeSingle()

      if (profile) {
        // Upsert notification preferences with SMS off
        await adminClient
          .from('notification_preferences')
          .upsert({
            user_id: profile.id,
            sms_reminders: false,
            host_announcements_sms: false,
          }, { onConflict: 'user_id' })
      }

      // Twilio handles STOP automatically, but we also update our DB
      return new Response(
        '<Response><Message>You\'ve been unsubscribed from Sonder Circle SMS. Reply START to resubscribe.</Message></Response>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      )
    }

    if (body === 'START' || body === 'SUBSCRIBE') {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('phone', from)
        .maybeSingle()

      if (profile) {
        await adminClient
          .from('notification_preferences')
          .upsert({
            user_id: profile.id,
            sms_reminders: true,
            host_announcements_sms: true,
          }, { onConflict: 'user_id' })
      }

      return new Response(
        '<Response><Message>Welcome back! You\'re now subscribed to Sonder Circle SMS notifications.</Message></Response>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      )
    }

    if (body === 'HELP') {
      return new Response(
        '<Response><Message>Sonder Circle is a private women\'s community events platform. Reply STOP to opt out of texts, START to re-subscribe. Visit sondercircle.com for more info.</Message></Response>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      )
    }

    // Default: no action
    return new Response('<Response></Response>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('twilio-webhook error:', err)
    return new Response('<Response></Response>', {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    })
  }
})
