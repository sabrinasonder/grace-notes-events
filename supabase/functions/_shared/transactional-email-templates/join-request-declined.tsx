/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, contentBox, receiptRow, receiptLabel, receiptValue, receiptAmount, receiptAmountLabel } from '../email-styles.ts'

interface JoinRequestDeclinedProps {
  eventTitle?: string
  hostName?: string
}

const JoinRequestDeclinedEmail = ({
  eventTitle = 'an upcoming gathering',
  hostName = 'The host',
}: JoinRequestDeclinedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your request to join {eventTitle} was not accepted</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          <Section style={accentBar} />
          <Text style={brand}>Sonder Circle</Text>
          <Section style={divider} />

          <Text style={heading}>Request not accepted</Text>

          <Text style={bodyText}>
            Unfortunately, {hostName} was unable to accept your request to join{' '}
            <span style={strong}>{eventTitle}</span> at this time.
          </Text>

          <Text style={bodyText}>
            Keep an eye on the circle — new gatherings are always around the corner.
          </Text>

          <Section style={divider} />

          <Text style={footer}>
            With warmth,<br />The Sonder Circle Team
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JoinRequestDeclinedEmail,
  subject: (data: Record<string, any>) =>
    `Update on your request to join ${data.eventTitle || 'an event'}`,
  displayName: 'Join request declined',
  previewData: {
    eventTitle: 'Wine & Watercolors Evening',
    hostName: 'Sabrina',
  },
} satisfies TemplateEntry
