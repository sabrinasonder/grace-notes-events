/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface JoinRequestDeclinedProps {
  eventTitle?: string
  hostName?: string
}

const JoinRequestDeclinedEmail = ({
  eventTitle = 'an upcoming gathering',
  hostName = 'The host',
}: JoinRequestDeclinedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your request to join {eventTitle} was not accepted</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>Request not accepted</Heading>
        <Text style={text}>
          Unfortunately, {hostName} was unable to accept your request to join <strong style={{ color: '#3A2A20' }}>{eventTitle}</strong> at this time.
        </Text>
        <Text style={text}>
          Keep an eye on the circle — new gatherings are always around the corner.
        </Text>
        <Text style={footer}>
          With warmth,<br />The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JoinRequestDeclinedEmail,
  subject: (data: Record<string, any>) =>
    `Update on your request to join ${data.eventTitle || 'an event'}`,
  displayName: 'Join request declined',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    hostName: 'Sabrina',
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
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
