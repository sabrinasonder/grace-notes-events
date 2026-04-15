import { createClient } from 'npm:@supabase/supabase-js@2'
import { type StripeEnv, createStripeClient } from '../_shared/stripe.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller's JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let eventId: string
  let appUrl: string
  try {
    const body = await req.json()
    eventId = body.eventId
    appUrl = body.appUrl || 'https://grace-notes-events.lovable.app'
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!eventId) {
    return new Response(JSON.stringify({ error: 'eventId is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Verify user is the host and event is active
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, host_id, status, price_cents')
    .eq('id', eventId)
    .single()

  if (eventErr || !event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (event.host_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Only the host can cancel' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (event.status === 'cancelled') {
    return new Response(JSON.stringify({ error: 'Event is already cancelled' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Get host profile
  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const hostName = hostProfile?.full_name || 'The host'

  // 3. Get all RSVPs (going + maybe) with profiles
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id, paid, stripe_payment_id')
    .eq('event_id', eventId)
    .in('status', ['going', 'maybe'])

  // 4. Refund all paid guests via Stripe
  const refundResults: { userId: string; success: boolean; error?: string }[] = []

  if (event.price_cents > 0 && rsvps?.length) {
    const paidRsvps = rsvps.filter((r) => r.paid && r.stripe_payment_id)

    for (const rsvp of paidRsvps) {
      try {
        // Get the payment intent from the checkout session
        const stripe = createStripeClient('sandbox')
        const session = await stripe.checkout.sessions.retrieve(rsvp.stripe_payment_id!)
        if (session.payment_intent) {
          const piId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id
          await stripe.refunds.create({ payment_intent: piId })
          refundResults.push({ userId: rsvp.user_id, success: true })
        }
      } catch (err: any) {
        console.error('Refund failed for user', rsvp.user_id, err.message)
        refundResults.push({ userId: rsvp.user_id, success: false, error: err.message })
      }
    }
  }

  // 5. Update event status to cancelled
  await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)

  // 6. Post system message in chat
  await supabase.from('messages').insert({
    event_id: eventId,
    sender_id: user.id,
    body: '⚠️ This event was cancelled by the host.',
  })

  // 7. Send cancellation emails to all RSVP'd guests
  if (rsvps?.length) {
    for (const rsvp of rsvps) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', rsvp.user_id)
        .single()

      if (profile?.email) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'event-cancellation',
            recipientEmail: profile.email,
            idempotencyKey: `event-cancel-${eventId}-${rsvp.user_id}`,
            templateData: {
              guestName: profile.full_name?.split(' ')[0] || undefined,
              eventTitle: event.title,
              hostName,
              wasPaid: rsvp.paid,
              eventUrl: `${appUrl}/event/${eventId}`,
            },
          },
        }).catch((e: any) => console.error('Email failed', rsvp.user_id, e))
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    refunds: refundResults,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
