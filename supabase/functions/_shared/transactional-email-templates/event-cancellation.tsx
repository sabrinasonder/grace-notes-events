/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface CancellationProps {
  guestName?: string
  eventTitle?: string
  hostName?: string
  wasPaid?: boolean
  eventUrl?: string
}

const EventCancellationEmail = ({
  guestName,
  eventTitle = 'your gathering',
  hostName = 'The host',
  wasPaid = false,
  eventUrl,
}: CancellationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{hostName} cancelled {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />

        <Heading style={h1}>
          {eventTitle} has been cancelled
        </Heading>

        <Text style={messageStyle}>
          {guestName ? `Hi ${guestName}, ` : ''}
          {hostName} has cancelled this gathering.
          {wasPaid
            ? ' Since you paid for this event, your refund is on the way — it typically takes 5–10 business days to appear on your statement.'
            : ''}
        </Text>

        <Text style={sorryNote}>
          We know it's disappointing. Hopefully another gathering will come along soon.
        </Text>

        {eventUrl && (
          <Button style={button} href={eventUrl}>
            View Event Details
          </Button>
        )}

        <Text style={footer}>
          This message was sent because you RSVP'd to an event on {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventCancellationEmail,
  subject: (data: Record<string, any>) =>
    `Cancelled: ${data.eventTitle || 'Your Sonder Circle gathering'}`,
  displayName: 'Event cancellation notification',
  previewData: {
    guestName: 'Ava',
    eventTitle: 'Wine & Watercolors Evening',
    hostName: 'Sarah',
    wasPaid: true,
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry

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
  margin: '0 0 16px',
}
const messageStyle = {
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.7',
  margin: '0 0 16px',
}
const sorryNote = {
  fontSize: '14px',
  color: '#B0A396',
  lineHeight: '1.6',
  fontStyle: 'italic' as const,
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
