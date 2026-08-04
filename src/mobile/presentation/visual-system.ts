export interface AppColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly text: string;
  readonly muted: string;
  readonly primary: string;
  readonly primaryText: string;
  readonly primarySoft: string;
  readonly accent: string;
  readonly accentText: string;
  readonly accentSoft: string;
  readonly border: string;
  readonly danger: string;
  readonly dangerSoft: string;
  readonly success: string;
  readonly successSoft: string;
  readonly focus: string;
  readonly shadow: string;
}

export const LIGHT_COLORS: AppColors = {
  background: "#F4F0E7",
  surface: "#FFFCF5",
  surfaceRaised: "#FFFFFF",
  text: "#102A27",
  muted: "#52635F",
  primary: "#075E54",
  primaryText: "#FFFFFF",
  primarySoft: "#DDEFE9",
  accent: "#A94429",
  accentText: "#FFFFFF",
  accentSoft: "#F8DED3",
  border: "#C8D3CE",
  danger: "#9D2929",
  dangerSoft: "#F8DEDC",
  success: "#176B45",
  successSoft: "#DDEFE3",
  focus: "#8A3FFC",
  shadow: "#17342F",
};

export const DARK_COLORS: AppColors = {
  background: "#0C1B19",
  surface: "#142724",
  surfaceRaised: "#1A302D",
  text: "#F6F2E8",
  muted: "#B6C4BF",
  primary: "#7AD9C3",
  primaryText: "#08241F",
  primarySoft: "#193D36",
  accent: "#FF9A76",
  accentText: "#29120B",
  accentSoft: "#44251D",
  border: "#3A4D48",
  danger: "#FFAAA5",
  dangerSoft: "#462526",
  success: "#7BD7A7",
  successSoft: "#193A2B",
  focus: "#C6A8FF",
  shadow: "#000000",
};

export const APP_SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
} as const;

export const APP_RADII = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const MINIMUM_TOUCH_TARGET = 48;
export const MAX_CONTENT_WIDTH = 680;

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^[\dA-Fa-f]{6}$/.test(normalized)) {
    throw new Error("El color debe estar expresado como hexadecimal de seis dígitos.");
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
