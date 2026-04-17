/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer } from '../email-styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your Sonder Circle password</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />

          <Text style={brand}>Sonder Circle</Text>

          <Section style={divider} />

          <Text style={heading}>Reset your password</Text>

          <Text style={bodyText}>
            We received a request to reset your password. Tap the button below to choose a new one.
          </Text>

          <Section style={buttonWrap}>
            <Button style={button} href={confirmationUrl}>
              Reset Password
            </Button>
          </Section>

          <Section style={divider} />

          <Text style={footer}>
            If you didn't request this, you can safely ignore this email. Your password won't be changed.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
