// MoneySeeker design tokens — '1 iOS-Native Clean' personality.
// Warm stone/sand base with Sage Green accent. No blue/indigo/purple.

export const colors = {
  surface: "#FCFCFA",
  onSurface: "#1A1C1A",
  surfaceSecondary: "#F3F3EF",
  onSurfaceSecondary: "#4A4C4A",
  surfaceTertiary: "#EAEAE5",
  onSurfaceTertiary: "#727472",
  surfaceInverse: "#1A1C1A",
  onSurfaceInverse: "#FCFCFA",

  brand: "#5A8265",
  brandPrimary: "#5A8265",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E5EDE7",
  onBrandSecondary: "#2C4533",
  brandTertiary: "#F2F7F4",
  onBrandTertiary: "#42614B",

  success: "#4D7858",
  onSuccess: "#FFFFFF",
  warning: "#C48A31",
  onWarning: "#FFFFFF",
  error: "#B84B4B",
  onError: "#FFFFFF",
  info: "#4A6C7C",
  onInfo: "#FFFFFF",

  border: "#E1E1DA",
  borderStrong: "#C2C2BA",
  divider: "#EBEBE4",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fonts = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const REMOTE_LABEL: Record<string, string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  intern: "Internship",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Lead / Manager",
};

export const STATUS_ORDER = [
  "Saved",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
] as const;

export const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  Saved: { bg: colors.surfaceTertiary, fg: colors.onSurfaceSecondary },
  Applied: { bg: colors.brandSecondary, fg: colors.onBrandSecondary },
  Interviewing: { bg: "#FBEFD8", fg: "#8A5E1B" },
  Offer: { bg: "#DDEEE1", fg: "#2C4533" },
  Rejected: { bg: "#F6E1E1", fg: "#8A3232" },
};

export function formatSalary(min?: number | null, max?: number | null): string {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  if (min) return `${k(min)}+`;
  if (max) return `Up to ${k(max)}`;
  return "Salary N/A";
}
