/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Sonder Circle'

interface PaymentReceiptProps {
  eventTitle?: string
  amount?: string
  eventDate?: string
}

const PaymentReceiptEmail = ({
  eventTitle = 'a gathering',
  amount = '$0.00',
  eventDate,
}: PaymentReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment confirmed — {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{SITE_NAME}</Text>
        <Hr style={divider} />
        <Heading style={h1}>Payment confirmed</Heading>
        <Text style={text}>
          Your payment of <strong>{amount}</strong> for <strong>{eventTitle}</strong> has been received. You're all set!
        </Text>
        {eventDate && <Text style={detail}>📅 {eventDate}</Text>}
        <Hr style={receiptDivider} />
        <Text style={receiptLine}>Event: {eventTitle}</Text>
        <Text style={receiptLine}>Amount paid: {amount}</Text>
        <Text style={receiptLine}>Status: ✅ Confirmed</Text>
        <Text style={footer}>
          If you have any questions, reply to this email or reach out to your host.
        </Text>
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
    amount: '$25.00',
    eventDate: 'Saturday, May 10 at 7:00 PM',
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
const detail = {
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.6',
  margin: '0 0 8px',
  fontWeight: 500 as const,
}
const receiptDivider = { borderColor: '#E8DDD4', margin: '24px 0' }
const receiptLine = {
  fontSize: '13px',
  color: '#3A2A20',
  lineHeight: '1.8',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#B0A396', margin: '32px 0 0', lineHeight: '1.5' }
