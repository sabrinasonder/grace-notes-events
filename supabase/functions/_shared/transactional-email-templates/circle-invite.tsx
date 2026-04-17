/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { body, outer, card, accentBar, brand, divider, heading, bodyText, buttonWrap, button, footer, strong, detailBlock, detailLine, detailLabel, detailValue, quoteBlock, quoteAuthor, contentBox } from '../email-styles.ts'

const SITE_NAME = 'Sonder Circle'

interface CircleInviteProps {
  inviterName?: string
  inviteeName?: string
  personalNote?: string | null
  city?: string | null
  acceptUrl?: string
}

const CircleInviteEmail = ({
  inviterName = 'A friend',
  inviteeName,
  personalNote,
  city,
  acceptUrl = '#',
}: CircleInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{inviterName} invited you to join {SITE_NAME}</Preview>
    <Body style={body}>
      <Container style={outer}>
        <Container style={card}>
          {/* Accent bar */}
          <Section style={accentBar} />

          {/* Brand */}
          <Text style={brand}>{SITE_NAME}</Text>

          {/* Divider */}
          <Section style={divider} />

          {/* Heading */}
          <Text style={heading}>
            {inviteeName ? `${inviteeName}, you're invited` : "You're invited"}
          </Text>

          <Text style={bodyText}>
            {inviterName} invited you to join {SITE_NAME}
            {city ? `, a private community for women in ${city}` : ', a private community for women'}.
          </Text>

          {personalNote && (
            <>
              <Text style={quoteBlock}>"{personalNote}"</Text>
              <Text style={quoteAuthor}>— {inviterName}</Text>
            </>
          )}

          <Section style={buttonWrap}>
            <Button style={button} href={acceptUrl}>
              Accept Your Invitation
            </Button>
          </Section>

          {/* Divider */}
          <Section style={divider} />

          <Text style={footer}>
            This invitation expires in 14 days. If you weren't expecting this, you can safely ignore it.
          </Text>
        </Container>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CircleInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data.inviterName || 'A friend'} invited you to join Sonder Circle`,
  displayName: 'Circle membership invite',
  previewData: {
    inviterName: 'Sarah',
    inviteeName: 'Jane',
    personalNote: "I think you'd love this community. We do wine nights, book clubs, and creative workshops. Come join us!",
    city: 'Austin',
    acceptUrl: 'https://sondercircle.com/accept-invite?token=example',
  },
} satisfies TemplateEntry
