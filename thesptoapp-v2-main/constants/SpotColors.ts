/**
 * The Spot App — Official Brand Color System
 *
 * Soft yellow × lighter purple palette
 *
 * Primary (Wisteria):  #C9A4D8   – soft wisteria
 * Background (Cream):  #FFFAE8   – warm butter cream
 *
 * All UI components must import and use SpotColors.
 */

export const SpotColors = {
  // ─── Brand ────────────────────────────────
  primary: "#C69FD5",
  background: "#FDFDC9",

  // ─── Surfaces ─────────────────────────────
  surface: "#FFFFFF",

  // ─── Text ─────────────────────────────────
  textPrimary: "#2E2040",
  textSecondary: "#7D6B8A",
  textOnPrimary: "#FFFFFF",

  // ─── Border / Shadow ────────────────────────
  border: "#EDE4F2",
  shadow: "#000000",

  // ─── Derived (lighter tint for gradients) ─
  primaryLight: "#E6D1F2",

  // ─── Status (functional, not brand) ───────
  error: "#FF5252",
  errorLight: "#FFEBEE",
  success: "#4CAF50",
  successLight: "#E8F5E9",
  successBorder: "#81C784",
  warning: "#FF9800",
  warningLight: "#FFF3E0",
  warningDark: "#E65100",
  warningBorder: "#FFB74D",
  info: "#2196F3",
  infoLight: "#E3F2FD",

  // ─── Derived palette (distinct tones) ──────
  secondary: "#B48ACC",
  accent: "#D8B4EC",
  rose: "#D98BA0",
  deepPink: "#9B6DAE",
  blush: "#F5D5DF",
  peach: "#F5CDA0",
  lavender: "#C4B0DB",
  softPink: "#F2E0EA",
  gradientLight: "#F6EFF9",
  gradientMid: "#E6D1F2",
  gradientCard: "#FBF6FF",
  textOnSecondary: "#FFFFFF",
  textOnAccent: "#2E2040",
} as const;

/** Dark mode equivalent — same keys, darker palette */
export const SpotColorsDark = {
  primary: "#C69FD5",
  background: "#1A1A2E",

  surface: "#242438",

  textPrimary: "#ECEDEE",
  textSecondary: "#9BA1A6",
  textOnPrimary: "#FFFFFF",

  border: "#3A3A50",
  shadow: "#000000",

  primaryLight: "#3D2F4A",

  error: "#FF6B6B",
  errorLight: "#3D1F1F",
  success: "#66BB6A",
  successLight: "#1F3D1F",
  successBorder: "#4CAF50",
  warning: "#FFB74D",
  warningLight: "#3D2F1F",
  warningDark: "#FF9800",
  warningBorder: "#FF9800",
  info: "#64B5F6",
  infoLight: "#1F2F3D",

  secondary: "#B388C9",
  accent: "#D4A9E0",
  rose: "#E8879C",
  deepPink: "#C69FD5",
  blush: "#8B5E6B",
  peach: "#A07050",
  lavender: "#B8A9D1",
  softPink: "#6B4A54",
  gradientLight: "#2A2040",
  gradientMid: "#352850",
  gradientCard: "#2E2444",
  textOnSecondary: "#FFFFFF",
  textOnAccent: "#ECEDEE",
} as const;
