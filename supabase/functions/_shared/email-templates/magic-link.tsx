/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName?: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for Sonder Circle — expires soon</Preview>
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
          <Text style={heading}>Your sign-in link</Text>

          <Text style={bodyText}>
            Tap below to sign in to Sonder Circle. This link expires in 1 hour — if
            you didn't request it, you can safely ignore this email.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Sign in to Sonder Circle
            </Button>
          </Section>

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            For security, never share this link with anyone.
            This link can only be used once.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
  margin: '0 40px 32px',
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
