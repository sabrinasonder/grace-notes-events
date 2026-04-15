/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

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
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>A note from {hostName}</Heading>
        <Text style={subheading}>Regarding: {eventTitle}</Text>
        <Text style={messageStyle}>{message}</Text>
        {eventUrl && (
          <Button style={button} href={eventUrl}>
            View Event
          </Button>
        )}
        <Text style={footer}>
          This message was sent by the host of your event on {SITE_NAME}.
        </Text>
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
  margin: '0 0 8px',
}
const subheading = {
  fontSize: '13px',
  color: '#B0A396',
  margin: '0 0 24px',
  fontStyle: 'italic' as const,
}
const messageStyle = {
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.7',
  margin: '0 0 28px',
  backgroundColor: '#FAF6EE',
  padding: '20px 24px',
  borderRadius: '12px',
}
const button = {
  backgroundColor: '#3A2A20',
  color: '#FAF6EE',
  fontSize: '14px',
  fontWeight: 500 as const,
  borderRadius: '24px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
