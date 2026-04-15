/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as rsvpConfirmation } from './rsvp-confirmation.tsx'
import { template as paymentReceipt } from './payment-receipt.tsx'
import { template as hostUpdate } from './host-update.tsx'
import { template as unreadMessagesDigest } from './unread-messages-digest.tsx'
import { template as eventCancellation } from './event-cancellation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'rsvp-confirmation': rsvpConfirmation,
  'payment-receipt': paymentReceipt,
  'host-update': hostUpdate,
  'unread-messages-digest': unreadMessagesDigest,
  'event-cancellation': eventCancellation,
}
