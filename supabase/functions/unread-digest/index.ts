import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://grace-notes-events.lovable.app'

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return new Response(JSON.stringify({ error: 'config' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Find all messages from the last 48h (to cover the 24h-inactivity window)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // Get all events with recent messages
  const { data: recentMessages, error: msgErr } = await supabase
    .from('messages')
    .select('id, event_id, sender_id, created_at')
    .gte('created_at', cutoff)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (msgErr || !recentMessages?.length) {
    console.log('No recent messages or error', msgErr)
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  // Get unique event IDs
  const eventIds = [...new Set(recentMessages.map((m) => m.event_id))]

  // Get all RSVPs for those events (going/maybe guests)
  const { data: rsvps, error: rsvpErr } = await supabase
    .from('rsvps')
    .select('user_id, event_id')
    .in('event_id', eventIds)
    .in('status', ['going', 'maybe'])

  if (rsvpErr || !rsvps?.length) {
    console.log('No RSVPs or error', rsvpErr)
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  // Also include hosts
  const { data: events } = await supabase
    .from('events')
    .select('id, title, host_id')
    .in('id', eventIds)

  const eventMap = new Map(events?.map((e) => [e.id, e]) || [])

  // Get all message_reads for these users in these events
  const userEventPairs = rsvps.map((r) => ({ userId: r.user_id, eventId: r.event_id }))
  // Add hosts
  events?.forEach((e) => {
    if (!userEventPairs.some((p) => p.userId === e.host_id && p.eventId === e.id)) {
      userEventPairs.push({ userId: e.host_id, eventId: e.id })
    }
  })

  const allUserIds = [...new Set(userEventPairs.map((p) => p.userId))]
  const allMsgIds = recentMessages.map((m) => m.id)

  const { data: reads } = await supabase
    .from('message_reads')
    .select('user_id, message_id')
    .in('user_id', allUserIds)
    .in('message_id', allMsgIds)

  const readSet = new Set((reads || []).map((r) => `${r.user_id}:${r.message_id}`))

  // Get sender profiles for names
  const senderIds = [...new Set(recentMessages.map((m) => m.sender_id))]
  const { data: senderProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', senderIds)

  const senderNameMap = new Map(
    (senderProfiles || []).map((p) => [p.id, p.full_name || 'Someone'])
  )

  // Check which digests we already sent today (via email_send_log)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: sentToday } = await supabase
    .from('email_send_log')
    .select('metadata')
    .eq('template_name', 'unread-messages-digest')
    .gte('created_at', todayStart.toISOString())
    .in('status', ['pending', 'sent'])

  const alreadySentKeys = new Set(
    (sentToday || [])
      .map((row) => {
        const meta = row.metadata as Record<string, any> | null
        return meta?.idempotency_key
      })
      .filter(Boolean)
  )

  // Get user profiles for emails and names
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', allUserIds)

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

  // 2. For each user+event, compute unread count
  let sentCount = 0
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const { userId, eventId } of userEventPairs) {
    const eventMsgs = recentMessages.filter(
      (m) => m.event_id === eventId && m.sender_id !== userId
    )

    const unreadMsgs = eventMsgs.filter((m) => !readSet.has(`${userId}:${m.id}`))

    if (unreadMsgs.length < 3) continue

    // Check oldest unread is > 24h ago (user hasn't been active)
    const oldestUnread = unreadMsgs[unreadMsgs.length - 1]
    if (new Date(oldestUnread.created_at) > twentyFourHoursAgo) continue

    // Check we haven't already sent today
    const dateKey = todayStart.toISOString().slice(0, 10)
    const idempotencyKey = `unread-digest-${userId}-${eventId}-${dateKey}`
    if (alreadySentKeys.has(idempotencyKey)) continue

    const profile = profileMap.get(userId)
    if (!profile?.email) continue

    const event = eventMap.get(eventId)
    const eventTitle = event?.title || 'your gathering'

    // Get unique sender names for this event's unread messages
    const unreadSenderIds = [...new Set(unreadMsgs.map((m) => m.sender_id))]
    const senderNames = unreadSenderIds
      .map((id) => senderNameMap.get(id))
      .filter(Boolean)
      .slice(0, 3) as string[]

    // Send via send-transactional-email
    const { error: sendErr } = await supabase.functions.invoke(
      'send-transactional-email',
      {
        body: {
          templateName: 'unread-messages-digest',
          recipientEmail: profile.email,
          idempotencyKey,
          templateData: {
            guestName: profile.full_name?.split(' ')[0] || undefined,
            eventTitle,
            unreadCount: unreadMsgs.length,
            senderNames,
            eventUrl: `${APP_URL}/event/${eventId}`,
          },
        },
      }
    )

    if (sendErr) {
      console.error('Failed to send digest', { userId, eventId, error: sendErr })
    } else {
      sentCount++
    }
  }

  console.log(`Digest run complete: ${sentCount} emails sent`)
  return new Response(JSON.stringify({ processed: sentCount }), { status: 200 })
})
