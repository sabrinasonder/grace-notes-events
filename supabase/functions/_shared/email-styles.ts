/**
 * Shared Sonder Circle email styles
 * All transactional + auth emails import from here for consistent branding.
 *
 * Design tokens match the app:
 *   cream   #FAF6EE   (background)
 *   paper   #FFFFFF   (card)
 *   espresso #1F1612  (heading text)
 *   cocoa   #3A2A20   (button bg, strong text)
 *   blush   #D89B86   (accent bar, highlights)
 *   taupe   #8C7A6B   (body text)
 *   muted   #B0A396   (footer, labels)
 *   border  #EDE5DB   (dividers)
 */

// ─── Outer shell ──────────────────────────────
export const body = {
  backgroundColor: '#FAF6EE',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '40px 16px',
}

export const outer = {
  maxWidth: '480px',
  margin: '0 auto',
}

export const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: '4px',
  overflow: 'hidden' as const,
  padding: '0 0 40px',
}

// ─── Accent bar (top of card) ─────────────────
export const accentBar = {
  backgroundColor: '#D89B86',
  height: '3px',
  width: '100%',
  margin: '0 0 36px',
}

// ─── Brand name ───────────────────────────────
export const brand = {
  fontFamily: "'Georgia', serif",
  fontSize: '15px',
  fontWeight: 400 as const,
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: '#1F1612',
  textAlign: 'center' as const,
  margin: '0 40px 0',
}

// ─── Divider ──────────────────────────────────
export const divider = {
  borderTop: '1px solid #EDE5DB',
  margin: '28px 40px',
}

// ─── Typography ───────────────────────────────
export const heading = {
  fontFamily: "'Georgia', serif",
  fontSize: '26px',
  fontWeight: 400 as const,
  color: '#1F1612',
  margin: '0 40px 16px',
  lineHeight: '1.3',
}

export const bodyText = {
  fontSize: '14px',
  color: '#7A6355',
  lineHeight: '1.7',
  margin: '0 40px 28px',
}

export const strong = {
  color: '#1F1612',
  fontWeight: 500 as const,
}

// ─── Detail block (When / Where) ──────────────
export const detailBlock = {
  margin: '0 40px 32px',
  borderLeft: '2px solid #EDE5DB',
  paddingLeft: '16px',
}

export const detailLine = {
  fontSize: '13px',
  color: '#7A6355',
  lineHeight: '1.8',
  margin: '0',
  display: 'block' as const,
}

export const detailLabel = {
  display: 'inline-block' as const,
  width: '52px',
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#B0A396',
}

export const detailValue = {
  color: '#1F1612',
  fontSize: '13px',
}

// ─── Quoted / highlight block ─────────────────
export const quoteBlock = {
  margin: '0 40px 28px',
  padding: '16px 20px',
  borderLeft: '3px solid #D89B86',
  fontStyle: 'italic' as const,
  fontFamily: "'Georgia', serif",
  fontSize: '15px',
  color: '#3A2A20',
  lineHeight: '1.6',
}

export const quoteAuthor = {
  fontSize: '12px',
  color: '#8C7A6B',
  margin: '4px 40px 24px 60px',
}

// ─── Inset content box (message, receipt, etc.) ─
export const contentBox = {
  margin: '0 40px 28px',
  padding: '20px 24px',
  backgroundColor: '#FAF6EE',
  borderRadius: '12px',
  fontSize: '14px',
  color: '#3A2A20',
  lineHeight: '1.7',
}

// ─── Button ───────────────────────────────────
export const buttonWrap = {
  textAlign: 'center' as const,
  margin: '0 40px 32px',
}

export const button = {
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

// ─── Footer ───────────────────────────────────
export const footer = {
  fontSize: '11px',
  color: '#B0A396',
  lineHeight: '1.6',
  margin: '0 40px',
  textAlign: 'center' as const,
}

// ─── Code / token display ─────────────────────
export const codeBlock = {
  fontFamily: "'Courier New', monospace",
  fontSize: '32px',
  fontWeight: 700 as const,
  letterSpacing: '0.25em',
  color: '#3A2A20',
  textAlign: 'center' as const,
  margin: '0 40px 28px',
  padding: '20px 0',
  backgroundColor: '#FAF6EE',
  borderRadius: '12px',
}

// ─── Receipt line ─────────────────────────────
export const receiptRow = {
  fontSize: '13px',
  color: '#7A6355',
  lineHeight: '1.8',
  margin: '0 40px',
  display: 'block' as const,
}

export const receiptLabel = {
  display: 'inline-block' as const,
  width: '80px',
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#B0A396',
}

export const receiptValue = {
  color: '#1F1612',
  fontSize: '13px',
}

export const receiptAmount = {
  fontFamily: "'Georgia', serif",
  fontSize: '28px',
  fontWeight: 400 as const,
  color: '#1F1612',
  textAlign: 'center' as const,
  margin: '0 40px 8px',
}

export const receiptAmountLabel = {
  fontSize: '11px',
  fontWeight: 600 as const,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: '#B0A396',
  textAlign: 'center' as const,
  margin: '0 40px 28px',
}
