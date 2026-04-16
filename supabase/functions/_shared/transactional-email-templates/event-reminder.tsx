/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface EventReminderProps {
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  hostName?: string
  eventUrl?: string
  hoursUntil?: number
}

const EventReminderEmail = ({
  eventTitle = 'your gathering',
  eventDate,
  eventLocation,
  hostName,
  eventUrl,
  hoursUntil,
}: EventReminderProps) => {
  const timeLabel = hoursUntil != null
    ? hoursUntil <= 24
      ? `tomorrow`
      : `in ${Math.round(hoursUntil / 24)} days`
    : 'soon'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reminder — {eventTitle} is {timeLabel}</Preview>
      <Body style={body}>
        <Container style={outer}>
          <Container style={card}>
            {/* Accent bar */}
            <Section style={accentBar} />

            {/* Brand */}
            <Text style={brand}>Sonder Circle</Text>

            {/* Divider */}
            <Section style={divider} />

            {/* Heading */}
            <Text style={heading}>See you {timeLabel}</Text>

            <Text style={bodyText}>
              Just a reminder that{' '}
              <span style={{ color: '#1F1612', fontWeight: 500 }}>{eventTitle}</span>
              {hostName ? ` hosted by ${hostName}` : ''} is coming up.
              We're looking forward to seeing you.
            </Text>

            {(eventDate || eventLocation) && (
              <Section style={detailBlock}>
                {eventDate && (
                  <Text style={detailLine}>
                    <span style={detailLabel}>When</span>
                    <span style={detailValue}>{eventDate}</span>
                  </Text>
                )}
                {eventLocation && (
                  <Text style={detailLine}>
                    <span style={detailLabel}>Where</span>
                    <span style={detailValue}>{eventLocation}</span>
                  </Text>
                )}
              </Section>
            )}

            {eventUrl && (
              <Section style={buttonWrap}>
                <Button style={button} href={eventUrl}>
                  View Event Details
                </Button>
              </Section>
            )}

            {/* Divider */}
            <Section style={divider} />

            <Text style={footer}>
              You received this because you RSVP'd to this event.
              You can manage your notification preferences in settings.
            </Text>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventReminderEmail,
  subject: (data: Record<string, any>) =>
    `Reminder — ${data.eventTitle || 'your event'} is coming up`,
  displayName: 'Event reminder',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    eventLocation: 'The Loft, Brooklyn',
    hostName: 'Sabrina',
    eventUrl: 'https://sondercircle.com/event/123',
    hoursUntil: 24,
  },
} satisfies TemplateEntry

const body = {
  backgroundColor: '#FAF6EE',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '40px 16px',
}
const outer = {
  maxWidth: '480px',
  margin: '0 auto',
}
const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: '4px',
  overflow: 'hidden' as const,
  padding: '0 0 40px',
}
const accentBar = {
  backgroundColor: '#D89B86',
  height: '3px',
  width: '100%',
  margin: '0 0 36px',
}
const brand = {
  fontFamily: "'Georgia', serif",
  fontSize: '15px',
  fontWeight: 400 as const,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: '#1F1612',
  textAlign: 'center' as const,
  margin: '0 40px 0',
}
const divider = {
  borderTop: '1px solid #EDE5DB',
  margin: '28px 40px',
}
const heading = {
  fontFamily: "'Georgia', serif",
  fontSize: '26px',
  fontWeight: 400 as const,
  color: '#1F1612',
  margin: '0 40px 16px',
  lineHeight: '1.3',
}
const bodyText = {
  fontSize: '14px',
  color: '#7A6355',
  lineHeight: '1.7',
  margin: '0 40px 28px',
}
const detailBlock = {
  margin: '0 40px 32px',
  borderLeft: '2px solid #EDE5DB',
  paddingLeft: '16px',
}
const detailLine = {
  fontSize: '13px',
  color: '#7A6355',
  lineHeight: '1.8',
  margin: '0',
  display: 'block' as const,
}
const detailLabel = {
  display: 'inline-block' as const,
  width: '52px',
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#B0A396',
}
const detailValue = {
  color: '#1F1612',
  fontSize: '13px',
}
const buttonWrap = {
  textAlign: 'center' as const,
  margin: '0 40px 32px',
}
const button = {
  backgroundColor: '#3A2A20',
  color: '#FAF6EE',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  fontWeight: 500 as const,
  letterSpacing: '0.08em',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 32px',
  borderRadius: '9999px',
  display: 'inline-block' as const,
}
const footer = {
  fontSize: '11px',
  color: '#B0A396',
  lineHeight: '1.6',
  margin: '0 40px',
  textAlign: 'center' as const,
}
