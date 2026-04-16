/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface PaymentReceiptProps {
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  amount?: string
  eventUrl?: string
}

const PaymentReceiptEmail = ({
  eventTitle = 'a gathering',
  eventDate,
  eventLocation,
  amount = '$0.00',
  eventUrl,
}: PaymentReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment confirmed — {eventTitle}</Preview>
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
          <Text style={heading}>Payment confirmed</Text>

          <Text style={bodyText}>
            Your spot is reserved for{' '}
            <span style={{ color: '#1F1612', fontWeight: 500 }}>{eventTitle}</span>.
            A receipt for {amount} has been recorded below.
          </Text>

          {/* Receipt block */}
          <Section style={receiptCard}>
            <Text style={receiptRow}>
              <span style={receiptKey}>Event</span>
              <span style={receiptVal}>{eventTitle}</span>
            </Text>
            {eventDate && (
              <Text style={receiptRow}>
                <span style={receiptKey}>Date</span>
                <span style={receiptVal}>{eventDate}</span>
              </Text>
            )}
            {eventLocation && (
              <Text style={receiptRow}>
                <span style={receiptKey}>Location</span>
                <span style={receiptVal}>{eventLocation}</span>
              </Text>
            )}
            <Section style={receiptDivider} />
            <Text style={receiptRow}>
              <span style={receiptKey}>Amount paid</span>
              <span style={{ ...receiptVal, fontWeight: 600, color: '#1F1612' }}>{amount}</span>
            </Text>
          </Section>

          {eventUrl && (
            <Section style={buttonWrap}>
              <Button style={button} href={eventUrl}>
                View Event Details
              </Button>
            </Section>
          )}

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            If you have any questions about your payment, contact your host or
            reach out to us at hello@sondercircle.com.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Payment confirmed — ${data.eventTitle || 'Sonder Circle gathering'}`,
  displayName: 'Payment receipt',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    eventLocation: 'The Loft, Brooklyn',
    amount: '$25.00',
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry

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
  margin: '0 40px 28px',
}
const receiptCard = {
  backgroundColor: '#FAF6EE',
  borderRadius: '4px',
  margin: '0 40px 32px',
  padding: '20px 24px',
}
const receiptRow = {
  fontSize: '13px',
  color: '#7A6355',
  lineHeight: '1.8',
  margin: '0',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
}
const receiptKey = {
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#B0A396',
  display: 'inline-block' as const,
  width: '90px',
  flexShrink: 0 as const,
}
const receiptVal = {
  color: '#3A2A20',
  fontSize: '13px',
  flex: 1 as const,
  textAlign: 'right' as const,
}
const receiptDivider = {
  borderTop: '1px solid #EDE5DB',
  margin: '12px 0',
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
