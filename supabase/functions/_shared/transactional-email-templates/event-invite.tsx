/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox } from '../email-styles.ts'

interface EventInviteProps {
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  hostName?: string
  eventUrl?: string
}

const EventInviteEmail = ({
  eventTitle = 'an upcoming gathering',
  eventDate,
  eventLocation,
  hostName = 'Your host',
  eventUrl,
}: EventInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{hostName} has invited you to {eventTitle}</Preview>
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
          <Text style={heading}>You're invited</Text>

          <Text style={bodyText}>
            {hostName} has invited you to join{' '}
            <span style={strong}>{eventTitle}</span>.
            We'd love to see you there.
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
                View Event & RSVP
              </Button>
            </Section>
          )}

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            You received this because someone in your circle invited you.
            You can manage your notification preferences in settings.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventInviteEmail,
  subject: (data: Record<string, any>) =>
    `You're invited to ${data.eventTitle || 'a gathering'}`,
  displayName: 'Event invite',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    eventLocation: 'The Loft, Brooklyn',
    hostName: 'Sabrina',
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry
