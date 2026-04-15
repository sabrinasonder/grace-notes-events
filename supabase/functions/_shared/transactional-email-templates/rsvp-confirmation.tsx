/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface RsvpConfirmationProps {
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  status?: string
}

const RsvpConfirmationEmail = ({
  eventTitle = 'an upcoming gathering',
  eventDate,
  eventLocation,
  status = 'going',
}: RsvpConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're {status} to {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>
          {status === 'going' ? 'You're in!' : status === 'maybe' ? 'Noted — maybe!' : 'We'll miss you'}
        </Heading>
        <Text style={text}>
          {status === 'going'
            ? `You've confirmed your spot for **${eventTitle}**. We can't wait to see you.`
            : status === 'maybe'
            ? `You've marked yourself as maybe for **${eventTitle}**. We hope you can make it!`
            : `You've declined the invitation to **${eventTitle}**. Maybe next time!`}
        </Text>
        {eventDate && <Text style={detail}>📅 {eventDate}</Text>}
        {eventLocation && <Text style={detail}>📍 {eventLocation}</Text>}
        <Text style={footer}>
          See you at the circle ✨
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RsvpConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `You're ${data.status || 'going'} — ${data.eventTitle || 'Sonder Circle gathering'}`,
  displayName: 'RSVP confirmation',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    eventLocation: 'The Loft, 123 Main St',
    status: 'going',
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
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
