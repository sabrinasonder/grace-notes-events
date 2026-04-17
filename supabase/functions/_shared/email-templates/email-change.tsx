/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer } from '../email-styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for Sonder Circle</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />

          <Text style={brand}>Sonder Circle</Text>

          <Section style={divider} />

          <Text style={heading}>Confirm your new email</Text>

          <Text style={bodyText}>
            You requested to change your email from{' '}
            <Link href={`mailto:${email}`} style={{ color: '#1F1612', textDecoration: 'underline' }}>{email}</Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={{ color: '#1F1612', textDecoration: 'underline' }}>{newEmail}</Link>.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Confirm Email Change
            </Button>
          </Section>

          <Section style={divider} />

          <Text style={footer}>
            If you didn't request this, please secure your account immediately.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
