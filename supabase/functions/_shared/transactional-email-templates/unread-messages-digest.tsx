/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface UnreadDigestProps {
  guestName?: string
  eventTitle?: string
  unreadCount?: number
  senderNames?: string[]
  eventUrl?: string
}

const UnreadMessagesDigestEmail = ({
  guestName,
  eventTitle = 'your gathering',
  unreadCount = 3,
  senderNames = [],
  eventUrl,
}: UnreadDigestProps) => {
  const preview = `${unreadCount} unread message${unreadCount === 1 ? '' : 's'} in ${eventTitle}`
  const sendersText =
    senderNames.length > 0
      ? senderNames.length === 1
        ? `${senderNames[0]} sent a message`
        : senderNames.length === 2
          ? `${senderNames[0]} and ${senderNames[1]} have been chatting`
          : `${senderNames[0]}, ${senderNames[1]} and others have been chatting`
      : 'New messages are waiting'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>{SITE_NAME}</Text>
          <Hr style={divider} />

          <Heading style={h1}>
            {guestName ? `${guestName}, you have` : 'You have'} unread messages
          </Heading>

          <Text style={eventLabel}>{eventTitle}</Text>

          <Text style={countBadge}>
            {unreadCount} unread message{unreadCount === 1 ? '' : 's'}
          </Text>

          <Text style={senderLine}>{sendersText}</Text>

          {eventUrl && (
            <Button style={button} href={eventUrl}>
              Catch Up on the Conversation
            </Button>
          )}

          <Text style={footer}>
            You're receiving this because you haven't checked in on this
            gathering in a while. We thought you'd want to stay in the loop.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: UnreadMessagesDigestEmail,
  subject: (data: Record<string, any>) =>
    `${data.unreadCount || 3} unread messages in ${data.eventTitle || 'your gathering'}`,
  displayName: 'Unread messages digest',
  previewData: {
    guestName: 'Ava',
    eventTitle: 'Wine & Watercolors Evening',
    unreadCount: 5,
    senderNames: ['Sarah', 'Mia'],
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry

/* ── Styles ─────────────────────────────────────── */
const main = { backgroundColor: '#ffffff', fontFamily: "'Manrope', 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const brand = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: '20px',
  fontWeight: 400 as const,
  color: '#1F1612',
  margin: '0 0 16px',
  textAlign: 'center' as const,
}
const divider = { borderColor: '#E8DDD4', margin: '0 0 32px' }
const h1 = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: '24px',
  fontWeight: 400 as const,
  color: '#1F1612',
  margin: '0 0 8px',
}
const eventLabel = {
  fontSize: '13px',
  color: '#B0A396',
  margin: '0 0 24px',
  fontStyle: 'italic' as const,
}
const countBadge = {
  fontSize: '14px',
  fontWeight: 600 as const,
  color: '#3A2A20',
  backgroundColor: '#FAF6EE',
  padding: '12px 20px',
  borderRadius: '12px',
  display: 'inline-block' as const,
  margin: '0 0 16px',
}
const senderLine = {
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.6',
  margin: '0 0 28px',
}
const button = {
  backgroundColor: '#3A2A20',
  color: '#FAF6EE',
  fontSize: '14px',
  fontWeight: 500 as const,
  borderRadius: '24px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
