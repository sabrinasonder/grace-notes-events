/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, contentBox, receiptRow, receiptLabel, receiptValue, receiptAmount, receiptAmountLabel } from '../email-styles.ts'

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
          <Section style={accentBar} />
          <Text style={brand}>Sonder Circle</Text>
          <Section style={divider} />

          <Text style={heading}>Payment confirmed</Text>

          <Text style={bodyText}>
            Your spot is reserved for{' '}
            <span style={strong}>{eventTitle}</span>.
            A receipt for {amount} has been recorded below.
          </Text>

          {/* Amount display */}
          <Text style={receiptAmount}>{amount}</Text>
          <Text style={receiptAmountLabel}>Amount Paid</Text>

          {/* Event details */}
          <Section style={detailBlock}>
            <Text style={detailLine}>
              <span style={detailLabel}>Event</span>
              <span style={detailValue}>{eventTitle}</span>
            </Text>
            {eventDate && (
              <Text style={detailLine}>
                <span style={detailLabel}>Date</span>
                <span style={detailValue}>{eventDate}</span>
              </Text>
            )}
            {eventLocation && (
              <Text style={detailLine}>
                <span style={detailLabel}>Where</span>
                <span style={detailValue}>{eventLocation}</span>
              </Text>
            )}
          </Section>

          {eventUrl && (
            <Section style={buttonWrap}>
              <Button style={button} href={eventUrl}>
                View Event Details
              </Button>
            </Section>
          )}

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
