/**
 * The Spot App — Centralized Theme Colors
 *
 * One UI-style modern pastel theme.
 * All values are sourced from the canonical SpotColors palette.
 *
 * Primary (Soft Wisteria): #C9A4D8
 * Background (Butter Cream): #FFFAE8
 */

import { SpotColors } from '@/constants/SpotColors';

// ─── Core palette (re-exported for convenience) ─────────────────────
export const COLORS = {
  primary: SpotColors.primary,           // #C9A4D8 — soft wisteria
  primaryLight: SpotColors.primaryLight, // #E6D1F2 — lighter variation
  background: SpotColors.background,     // #FFFAE8 — warm butter cream
  surface: SpotColors.surface,           // #FFFFFF
  textPrimary: SpotColors.textPrimary,   // #2E2040
  textSecondary: SpotColors.textSecondary, // #7D6B8A
  error: SpotColors.error,              // #FF5252
  border: SpotColors.border,            // #EDE4F2
} as const;

// ─── Semantic helpers ───────────────────────────────────────────────
/** 15 % primary tint — useful for subtle highlights / pressed states */
export const primaryTint = 'rgba(201,164,216,0.15)';

/** Focus ring color — primary at 25 % for input focus glow */
export const primaryFocusRing = 'rgba(201,164,216,0.25)';

// ─── Spacing scale (4-pt grid) ─────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// ─── Border radii ──────────────────────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 28,
  full: 9999,
} as const;

// ─── Shadows (iOS / Android) ───────────────────────────────────────
export const SHADOWS = {
  /** Subtle card shadow */
  card: {
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  /** Medium elevation for modals / floating elements */
  medium: {
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  /** Prominent elevation (buttons, popovers) */
  prominent: {
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Typography scale ──────────────────────────────────────────────
export const TYPOGRAPHY = {
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
  subtitle: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  button: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;
