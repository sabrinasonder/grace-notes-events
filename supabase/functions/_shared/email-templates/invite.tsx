/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer } from '../email-styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to Sonder Circle</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />

          <Text style={brand}>Sonder Circle</Text>

          <Section style={divider} />

          <Text style={heading}>You're invited</Text>

          <Text style={bodyText}>
            Someone special has invited you to join{' '}
            <Link href={siteUrl} style={{ color: '#1F1612', textDecoration: 'underline' }}><strong>Sonder Circle</strong></Link>
            — a private community for intimate gatherings. Tap below to accept.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Accept Invitation
            </Button>
          </Section>

          <Section style={divider} />

          <Text style={footer}>
            If you weren't expecting this, you can safely ignore this email.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
