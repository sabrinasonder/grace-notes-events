/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface EventInviteProps {
  eventTitle?: string
  eventDate?: string
  hostName?: string
  eventUrl?: string
}

const EventInviteEmail = ({
  eventTitle = 'an upcoming gathering',
  eventDate,
  hostName = 'A host',
  eventUrl,
}: EventInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{hostName} invited you to {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>You're invited!</Heading>
        <Text style={text}>
          {hostName} has invited you to <strong style={{ color: '#3A2A20' }}>{eventTitle}</strong>.
        </Text>
        {eventDate && <Text style={detail}>📅 {eventDate}</Text>}
        {eventUrl && (
          <Button style={button} href={eventUrl}>
            View Event & RSVP
          </Button>
        )}
        <Text style={footer}>
          See you at the circle ✨
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventInviteEmail,
  subject: (data: Record<string, any>) =>
    `You're invited to ${data.eventTitle || 'an event'}`,
  displayName: 'Event invite',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    hostName: 'Sabrina',
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
const text = {
  fontSize: '14px',
  color: '#8C7A6B',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const detail = {
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.6',
  margin: '0 0 8px',
  fontWeight: 500 as const,
}
const button = {
  backgroundColor: '#D89B86',
  color: '#ffffff',
  fontFamily: "'Manrope', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 600 as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
  borderRadius: '9999px',
  display: 'inline-block' as const,
  margin: '8px 0 24px',
}
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
