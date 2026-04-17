/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, codeBlock, footer } from '../email-styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code for Sonder Circle</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />

          <Text style={brand}>Sonder Circle</Text>

          <Section style={divider} />

          <Text style={heading}>Verification code</Text>

          <Text style={bodyText}>Use the code below to confirm your identity:</Text>

          <Text style={codeBlock}>{token}</Text>

          <Section style={divider} />

          <Text style={footer}>
            This code will expire shortly. If you didn't request it, you can safely ignore this email.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
