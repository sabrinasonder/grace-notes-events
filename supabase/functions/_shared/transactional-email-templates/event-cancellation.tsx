/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox } from '../email-styles.ts'

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
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          {/* Accent bar */}
          <Section style={accentBar} />

          {/* Brand */}
          <Text style={brand}>{SITE_NAME}</Text>

          {/* Divider */}
          <Section style={divider} />

          {/* Heading */}
          <Text style={heading}>
            {eventTitle} has been cancelled
          </Text>

          <Text style={bodyText}>
            {guestName ? `Hi ${guestName}, ` : ''}
            {hostName} has cancelled this gathering.
            {wasPaid
              ? ' Since you paid for this event, your refund is on the way — it typically takes 5–10 business days to appear on your statement.'
              : ''}
          </Text>

          <Text style={bodyText}>
            <em>We know it's disappointing. Hopefully another gathering will come along soon.</em>
          </Text>

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
            This message was sent because you RSVP'd to an event on {SITE_NAME}.
          </Text>
        </Container>
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
