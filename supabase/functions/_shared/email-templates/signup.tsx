/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer } from '../email-styles.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Sonder Circle — confirm your email</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />

          <Text style={brand}>Sonder Circle</Text>

          <Section style={divider} />

          <Text style={heading}>Welcome aboard</Text>

          <Text style={bodyText}>
            We're so glad you're here. Confirm your email address (
            <Link href={`mailto:${recipient}`} style={{ color: '#1F1612', textDecoration: 'underline' }}>{recipient}</Link>
            ) to join the circle.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Confirm Email
            </Button>
          </Section>

          <Section style={divider} />

          <Text style={footer}>
            If you didn't sign up for Sonder Circle, you can safely ignore this email.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
