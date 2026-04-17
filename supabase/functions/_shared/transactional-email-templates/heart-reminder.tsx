/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, contentBox, receiptRow, receiptLabel, receiptValue, receiptAmount, receiptAmountLabel } from '../email-styles.ts'

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
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />
          <Text style={brand}>Sonder Circle</Text>
          <Section style={divider} />

          <Text style={heading}>Don't miss out</Text>

          <Text style={bodyText}>
            You hearted <span style={strong}>{eventTitle}</span>
            {eventDate ? ` — it's happening ${eventDate}` : ''}.
            Want to make it official?
          </Text>

          {eventUrl && (
            <Section style={buttonWrap}>
              <Button style={button} href={eventUrl}>
                RSVP Now
              </Button>
            </Section>
          )}

          <Section style={divider} />

          <Text style={footer}>
            Warmly,<br />
            The Sonder Circle Team
          </Text>
        </Container>
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
