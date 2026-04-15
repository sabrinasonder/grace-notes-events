/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface CircleInviteProps {
  inviterName?: string
  inviteeName?: string
  personalNote?: string | null
  city?: string | null
  acceptUrl?: string
}

const CircleInviteEmail = ({
  inviterName = 'A friend',
  inviteeName,
  personalNote,
  city,
  acceptUrl = '#',
}: CircleInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{inviterName} invited you to join {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>
          {inviteeName ? `${inviteeName}, you're invited` : "You're invited"}
        </Heading>
        <Text style={text}>
          {inviterName} invited you to join {SITE_NAME}
          {city ? `, a private community for women in ${city}` : ', a private community for women'}.
        </Text>
        {personalNote && (
          <>
            <Text style={noteStyle}>"{personalNote}"</Text>
            <Text style={noteAuthor}>— {inviterName}</Text>
          </>
        )}
        <Button style={button} href={acceptUrl}>
          Accept Your Invitation
        </Button>
        <Text style={footer}>
          This invitation expires in 14 days. If you weren't expecting this, you can safely ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CircleInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data.inviterName || 'A friend'} invited you to join Sonder Circle`,
  displayName: 'Circle membership invite',
  previewData: {
    inviterName: 'Sarah',
    inviteeName: 'Jane',
    personalNote: "I think you'd love this community. We do wine nights, book clubs, and creative workshops. Come join us!",
    city: 'Austin',
    acceptUrl: 'https://sondercircle.com/accept-invite?token=example',
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
const noteStyle = {
  fontSize: '15px',
  color: '#3A2A20',
  lineHeight: '1.6',
  margin: '0 0 4px',
  fontStyle: 'italic' as const,
  fontFamily: "'Fraunces', Georgia, serif",
  padding: '16px 20px',
  borderLeft: '3px solid #D89B86',
}
const noteAuthor = {
  fontSize: '12px',
  color: '#8C7A6B',
  margin: '0 0 24px',
  paddingLeft: '20px',
}
const button = {
  backgroundColor: '#3A2A20',
  color: '#FAF6EE',
  fontSize: '11px',
  fontWeight: 600 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.22em',
  padding: '14px 28px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-block' as const,
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
