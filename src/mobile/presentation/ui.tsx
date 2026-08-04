import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppColors } from "./theme.js";
import {
  APP_RADII,
  APP_SPACING,
  MINIMUM_TOUCH_TARGET,
} from "./visual-system.js";

export function BrandMark({ compact = false }: { readonly compact?: boolean }) {
  const colors = useAppColors();
  const size = compact ? 36 : 48;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.brandMark,
        {
          width: size,
          height: size,
          backgroundColor: colors.primary,
          borderColor: colors.text,
        },
      ]}
    >
      <View style={[styles.brandStem, { backgroundColor: colors.primaryText }]} />
      <View style={[styles.brandLeaf, { backgroundColor: colors.accent }]} />
      <View style={[styles.brandDot, { backgroundColor: colors.primaryText }]} />
    </View>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.pageIntro}>
      <View style={styles.introTopline}>
        <BrandMark />
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.pageDescription, { color: colors.muted }]}>
        {description}
      </Text>
    </View>
  );
}

export function SectionHeading({
  number,
  title,
  description,
}: {
  readonly number?: string;
  readonly title: string;
  readonly description?: string;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}>
        {number === undefined ? null : (
          <View style={[styles.sectionNumber, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.sectionNumberText, { color: colors.primary }]}>{number}</Text>
          </View>
        )}
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {description === undefined ? null : (
        <Text style={[styles.sectionDescription, { color: colors.muted }]}>
          {description}
        </Text>
      )}
    </View>
  );
}

export function AppCard({
  children,
  tone = "plain",
  style,
  accessible,
  accessibilityLabel,
}: {
  readonly children: ReactNode;
  readonly tone?: "plain" | "primary" | "accent";
  readonly style?: StyleProp<ViewStyle>;
  readonly accessible?: boolean;
  readonly accessibilityLabel?: string;
}) {
  const colors = useAppColors();
  const backgroundColor =
    tone === "primary"
      ? colors.primarySoft
      : tone === "accent"
        ? colors.accentSoft
        : colors.surfaceRaised;
  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor: tone === "plain" ? colors.border : "transparent",
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  accessibilityHint,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "secondary" | "danger" | "quiet";
  readonly accessibilityHint?: string;
}) {
  const colors = useAppColors();
  const [focused, setFocused] = useState(false);
  const foreground =
    variant === "primary"
      ? colors.primaryText
      : variant === "danger"
        ? colors.danger
        : colors.primary;
  const background = variant === "primary" ? colors.primary : "transparent";
  const border =
    variant === "quiet"
      ? "transparent"
      : variant === "danger"
        ? colors.danger
        : colors.primary;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: focused ? colors.focus : border,
          borderWidth: focused ? 3 : 2,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
          transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
        },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
      {variant === "primary" ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.buttonArrow, { color: foreground }]}
        >
          →
        </Text>
      ) : null}
    </Pressable>
  );
}

export function StatusMessage({
  children,
  tone,
  onDismiss,
}: {
  readonly children: ReactNode;
  readonly tone: "success" | "danger" | "info";
  readonly onDismiss?: () => void;
}) {
  const colors = useAppColors();
  const foreground =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : colors.primary;
  const background =
    tone === "success"
      ? colors.successSoft
      : tone === "danger"
        ? colors.dangerSoft
        : colors.primarySoft;
  const role: AccessibilityRole = tone === "danger" ? "alert" : "text";
  const content = (
    <View style={styles.statusContent}>
      <View style={[styles.statusDot, { backgroundColor: foreground }]} />
      <Text style={[styles.statusText, { color: foreground }]}>{children}</Text>
      {onDismiss === undefined ? null : (
        <Text style={[styles.statusClose, { color: foreground }]}>Cerrar</Text>
      )}
    </View>
  );
  return onDismiss === undefined ? (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={role}
      style={[styles.status, { backgroundColor: background }]}
    >
      {content}
    </View>
  ) : (
    <Pressable
      accessibilityHint="Descarta este mensaje"
      accessibilityRole="button"
      onPress={onDismiss}
      style={({ pressed }) => [
        styles.status,
        { backgroundColor: background, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Tag({ children, accent = false }: { readonly children: ReactNode; readonly accent?: boolean }) {
  const colors = useAppColors();
  return (
    <View style={[styles.tag, { backgroundColor: accent ? colors.accentSoft : colors.primarySoft }]}>
      <Text style={[styles.tagText, { color: accent ? colors.accent : colors.primary }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    borderRadius: 15,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  brandStem: { bottom: 8, height: 22, left: 13, position: "absolute", width: 5 },
  brandLeaf: { borderRadius: 8, height: 15, left: 18, position: "absolute", top: 9, transform: [{ rotate: "-28deg" }], width: 9 },
  brandDot: { borderRadius: 4, height: 7, position: "absolute", right: 8, top: 8, width: 7 },
  pageIntro: { gap: APP_SPACING.sm },
  introTopline: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.sm },
  eyebrow: { fontSize: 13, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  pageTitle: { fontSize: 34, fontWeight: "900", letterSpacing: -1.1, lineHeight: 39 },
  pageDescription: { fontSize: 16, lineHeight: 24, maxWidth: 560 },
  sectionHeading: { gap: APP_SPACING.xs },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.sm },
  sectionNumber: { alignItems: "center", borderRadius: APP_RADII.pill, height: 32, justifyContent: "center", width: 32 },
  sectionNumberText: { fontSize: 13, fontWeight: "900" },
  sectionTitle: { flex: 1, fontSize: 21, fontWeight: "800", letterSpacing: -0.3, lineHeight: 27 },
  sectionDescription: { fontSize: 14, lineHeight: 21, paddingLeft: 44 },
  card: {
    borderRadius: APP_RADII.large,
    borderWidth: 1,
    elevation: 1,
    padding: APP_SPACING.lg,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  button: {
    alignItems: "center",
    borderRadius: APP_RADII.medium,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_TARGET + 6,
    paddingHorizontal: APP_SPACING.md,
    paddingVertical: APP_SPACING.sm,
  },
  buttonLabel: { flexShrink: 1, fontSize: 16, fontWeight: "800", textAlign: "center" },
  buttonArrow: { fontSize: 21, fontWeight: "700", marginLeft: APP_SPACING.xs },
  status: { borderRadius: APP_RADII.medium, minHeight: MINIMUM_TOUCH_TARGET, padding: APP_SPACING.sm },
  statusContent: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.sm },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
  statusText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  statusClose: { fontSize: 13, fontWeight: "800" },
  tag: { alignSelf: "flex-start", borderRadius: APP_RADII.pill, paddingHorizontal: 11, paddingVertical: 6 },
  tagText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
});
