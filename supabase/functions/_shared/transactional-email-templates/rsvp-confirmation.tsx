/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox, buttonWrap, button } from '../email-styles.ts'

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
    <Preview>You are {status} to {eventTitle}</Preview>
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
            {status === 'going' ? "You're in!" : status === 'maybe' ? 'Noted — maybe!' : "We'll miss you"}
          </Text>

          <Text style={bodyText}>
            {status === 'going'
              ? `You've confirmed your spot for ${eventTitle}. We can't wait to see you.`
              : status === 'maybe'
              ? `You've marked yourself as maybe for ${eventTitle}. We hope you can make it!`
              : `You've declined the invitation to ${eventTitle}. Maybe next time!`}
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

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            See you at the circle
          </Text>
        </Container>
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
