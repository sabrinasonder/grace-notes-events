/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox } from '../email-styles.ts'

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
              <span style={strong}>{eventTitle}</span>
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
