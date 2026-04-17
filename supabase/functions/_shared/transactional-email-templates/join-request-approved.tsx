/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, contentBox, receiptRow, receiptLabel, receiptValue, receiptAmount, receiptAmountLabel } from '../email-styles.ts'

interface JoinRequestApprovedProps {
  eventTitle?: string
  eventDate?: string
  hostName?: string
  eventUrl?: string
}

const JoinRequestApprovedEmail = ({
  eventTitle = 'an upcoming gathering',
  eventDate,
  hostName = 'The host',
  eventUrl,
}: JoinRequestApprovedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're in! Your request to join {eventTitle} was approved</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />
          <Text style={brand}>Sonder Circle</Text>
          <Section style={divider} />

          <Text style={heading}>You've been approved!</Text>

          <Text style={bodyText}>
            {hostName} has approved your request to join{' '}
            <span style={strong}>{eventTitle}</span>. You're now on the guest list.
          </Text>

          {eventDate && (
            <Section style={detailBlock}>
              <Text style={detailLine}>
                <span style={detailLabel}>When</span>
                <span style={detailValue}>{eventDate}</span>
              </Text>
            </Section>
          )}

          {eventUrl && (
            <Section style={buttonWrap}>
              <Button style={button} href={eventUrl}>
                View Event Details
              </Button>
            </Section>
          )}

          <Section style={divider} />

          <Text style={footer}>
            See you at the circle
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JoinRequestApprovedEmail,
  subject: (data: Record<string, any>) =>
    `You're in! ${data.eventTitle || 'Event'} request approved`,
  displayName: 'Join request approved',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    eventDate: 'Saturday, May 10 at 7:00 PM',
    hostName: 'Sabrina',
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry
