/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox } from '../email-styles.ts'

const SITE_NAME = 'Sonder Circle'

interface HostUpdateProps {
  eventTitle?: string
  hostName?: string
  message?: string
  eventUrl?: string
}

const HostUpdateEmail = ({
  eventTitle = 'an upcoming gathering',
  hostName = 'Your host',
  message = '',
  eventUrl,
}: HostUpdateProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update from {hostName} about {eventTitle}</Preview>
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
          <Text style={heading}>A note from {hostName}</Text>

          <Text style={bodyText}>Regarding: {eventTitle}</Text>

          <Text style={contentBox}>{message}</Text>

          {eventUrl && (
            <Section style={buttonWrap}>
              <Button style={button} href={eventUrl}>
                View Event
              </Button>
            </Section>
          )}

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            This message was sent by the host of your event on {SITE_NAME}.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HostUpdateEmail,
  subject: (data: Record<string, any>) =>
    `Update: ${data.eventTitle || 'Your Sonder Circle gathering'}`,
  displayName: 'Host update notification',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    hostName: 'Sarah',
    message: 'Hey everyone! Just a reminder to bring your own apron if you have one. See you Saturday! 🎨',
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry
