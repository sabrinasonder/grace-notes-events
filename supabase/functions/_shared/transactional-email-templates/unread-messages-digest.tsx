/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, contentBox, receiptRow, receiptLabel, receiptValue, receiptAmount, receiptAmountLabel } from '../email-styles.ts'

interface UnreadDigestProps {
  guestName?: string
  eventTitle?: string
  unreadCount?: number
  senderNames?: string[]
  eventUrl?: string
}

const UnreadMessagesDigestEmail = ({
  guestName,
  eventTitle = 'your gathering',
  unreadCount = 3,
  senderNames = [],
  eventUrl,
}: UnreadDigestProps) => {
  const preview = `${unreadCount} unread message${unreadCount === 1 ? '' : 's'} in ${eventTitle}`
  const sendersText =
    senderNames.length > 0
      ? senderNames.length === 1
        ? `${senderNames[0]} sent a message`
        : senderNames.length === 2
          ? `${senderNames[0]} and ${senderNames[1]} have been chatting`
          : `${senderNames[0]}, ${senderNames[1]} and others have been chatting`
      : 'New messages are waiting'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={outer}>
          <Container style={card}>
            <Section style={accentBar} />
            <Text style={brand}>Sonder Circle</Text>
            <Section style={divider} />

            <Text style={heading}>
              {guestName ? `${guestName}, you have` : 'You have'} unread messages
            </Text>

            <Section style={contentBox}>
              <Text style={{ fontSize: '13px', color: '#B0A396', margin: '0 0 8px', fontStyle: 'italic' as const }}>
                {eventTitle}
              </Text>
              <Text style={{ fontSize: '14px', fontWeight: 600 as const, color: '#3A2A20', margin: '0 0 8px' }}>
                {unreadCount} unread message{unreadCount === 1 ? '' : 's'}
              </Text>
              <Text style={{ fontSize: '14px', color: '#3A2A20', lineHeight: '1.6', margin: '0' }}>
                {sendersText}
              </Text>
            </Section>

            {eventUrl && (
              <Section style={buttonWrap}>
                <Button style={button} href={eventUrl}>
                  Catch Up on the Conversation
                </Button>
              </Section>
            )}

            <Section style={divider} />

            <Text style={footer}>
              You're receiving this because you haven't checked in on this
              gathering in a while. We thought you'd want to stay in the loop.
            </Text>
          </Container>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: UnreadMessagesDigestEmail,
  subject: (data: Record<string, any>) =>
    `${data.unreadCount || 3} unread messages in ${data.eventTitle || 'your gathering'}`,
  displayName: 'Unread messages digest',
  previewData: {
    guestName: 'Ava',
    eventTitle: 'Wine & Watercolors Evening',
    unreadCount: 5,
    senderNames: ['Sarah', 'Mia'],
    eventUrl: 'https://sondercircle.com/event/123',
  },
} satisfies TemplateEntry
