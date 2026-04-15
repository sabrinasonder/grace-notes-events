---
name: Design tokens
description: Full color palette with cream/cocoa/espresso/taupe/paper, typography rules, editorial component patterns
type: design
---

## Colors (HSL in CSS vars)
- --background/ivory: #FAF6EE (37 60% 96%) — page bg
- --card/paper: #FFFFFF (0 0% 100%) — card bg
- --cream: #F4EFE6 (37 42% 93%) — subtle accent bg, divider borders
- --cocoa: #3A2A20 (23 30% 18%) — primary CTA bg, secondary text
- --espresso: #1F1612 (18 27% 10%) — headline text
- --blush: #D89B86 (15 50% 68%) — highlight accents, icons
- --sage: #7E8C6F (92 11% 49%) — nature accents, confirmed status
- --taupe: #A89684 (28 15% 59%) — metadata, tertiary text
- --paper: #FFFFFF — card surfaces

## Typography
- Headlines/titles: font-serif (Fraunces), weight 300-400, tight tracking
- Body/descriptions: font-serif italic for editorial copy
- UI labels/buttons/nav: font-sans (Manrope)
- Metadata: font-sans text-[10px] font-semibold uppercase tracking-[0.22em]

## Component patterns
- No rounded-lg bordered boxes — use border-b border-cream dividers
- Avatars: blush/30 bg with serif initials fallback
- Buttons: rounded-full, cocoa bg, uppercase tracking-wide
- Tabs: flat with underline indicator, not pill containers
- Bottom bars: gradient fade background
- Guest confirmed: sage/20 bg status pill
