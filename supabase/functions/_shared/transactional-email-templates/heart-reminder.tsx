/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface HeartReminderProps {
  eventTitle?: string
  eventDate?: string
  eventUrl?: string
}

const HeartReminderEmail = ({
  eventTitle = 'an upcoming gathering',
  eventDate,
  eventUrl,
}: HeartReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You hearted {eventTitle} — it's happening soon!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>
          Don't miss out ✨
        </Heading>
        <Text style={text}>
          You hearted <strong>{eventTitle}</strong>
          {eventDate ? ` — it's happening ${eventDate}` : ''}.
          Want to make it official?
        </Text>
        {eventUrl && (
          <Button href={eventUrl} style={button}>
            RSVP Now
          </Button>
        )}
        <Text style={footer}>
          Warmly,<br />
          The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HeartReminderEmail,
  subject: (data: Record<string, any>) =>
    `You hearted ${data.eventTitle || 'an event'} — it's happening soon!`,
  displayName: 'Heart reminder',
  previewData: {
    eventTitle: 'Wine & Watercolors',
    eventDate: 'Saturday at 7:00 PM',
    eventUrl: 'https://example.com/event/123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Manrope', Arial, sans-serif" }
const container = { padding: '30px 25px' }
const brand = { fontSize: '13px', fontWeight: '600' as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#A89684', margin: '0 0 20px' }
const divider = { borderColor: '#F4EFE6', margin: '0 0 28px' }
const h1 = { fontFamily: "'Fraunces', Georgia, serif", fontSize: '26px', fontWeight: '400' as const, color: '#1F1612', letterSpacing: '-0.02em', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3A2A20', lineHeight: '1.6', margin: '0 0 28px' }
const button = { backgroundColor: '#3A2A20', borderRadius: '50px', color: '#FAF6EE', fontFamily: "'Manrope', Arial, sans-serif", fontSize: '11px', fontWeight: '600' as const, letterSpacing: '0.2em', textTransform: 'uppercase' as const, padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#A89684', lineHeight: '1.5', margin: '36px 0 0' }
