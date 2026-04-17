/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer } from '../email-styles.ts'

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
