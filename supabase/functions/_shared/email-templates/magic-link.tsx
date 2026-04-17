/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, codeBlock, footer } from '../email-styles.ts'

interface MagicLinkEmailProps {
  siteName?: string
  confirmationUrl?: string
  token?: string
}

export const MagicLinkEmail = ({
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => {
  const isOtp = !!token && !confirmationUrl

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isOtp
          ? `Your sign-in code for Sonder Circle: ${token}`
          : 'Your sign-in link for Sonder Circle — expires soon'}
      </Preview>
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
            <Text style={heading}>
              {isOtp ? 'Your sign-in code' : 'Your sign-in link'}
            </Text>

            <Text style={bodyText}>
              {isOtp
                ? 'Enter this code to sign in to Sonder Circle. It expires in 10 minutes — if you didn\'t request it, you can safely ignore this email.'
                : 'Tap below to sign in to Sonder Circle. This link expires in 1 hour — if you didn\'t request it, you can safely ignore this email.'}
            </Text>

            {isOtp ? (
              <Text style={codeBlock}>{token}</Text>
            ) : (
              <Section style={buttonWrap}>
                <Button style={button} href={confirmationUrl}>
                  Sign in to Sonder Circle
                </Button>
              </Section>
            )}

            {/* Divider */}
            <Section style={divider} />

            <Text style={footer}>
              For security, never share this {isOtp ? 'code' : 'link'} with anyone.
              {isOtp ? ' This code can only be used once.' : ' This link can only be used once.'}
            </Text>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail
