import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

// ---------------- Button ----------------
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const bg = isPrimary ? colors.brandPrimary : isGhost ? "transparent" : colors.surfaceSecondary;
  const fg = isPrimary ? colors.onBrandPrimary : colors.onSurface;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(
      isPrimary ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        isGhost && styles.ghostBtn,
        !isPrimary && !isGhost && styles.secondaryBorder,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnContent}>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------- Chip ----------------
export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipDefault]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------- Skeleton ----------------
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | string; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ height, width: width as any, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, opacity }, style]}
    />
  );
}

// ---------------- EmptyState ----------------
export function EmptyState({
  icon = "inbox",
  title,
  subtitle,
  ctaLabel,
  onCta,
  testID,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={30} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.xl }} testID="empty-cta" />
      ) : null}
    </View>
  );
}

// ---------------- Toast ----------------
type ToastType = "success" | "error" | "info";
interface ToastCtx {
  show: (message: string, type?: ToastType) => void;
}
const ToastContext = createContext<ToastCtx | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("info");
  const translateY = useRef(new Animated.Value(-120)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, t: ToastType = "info") => {
      setMsg(message);
      setType(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(translateY, { toValue: -160, duration: 250, useNativeDriver: true }).start(
          () => setMsg(null),
        );
      }, 2400);
    },
    [translateY],
  );

  const bg =
    type === "success" ? colors.success : type === "error" ? colors.error : colors.surfaceInverse;
  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info";

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg !== null && (
        <Animated.View
          testID="toast"
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + spacing.sm, backgroundColor: bg, transform: [{ translateY }] }]}
        >
          <Feather name={iconName as any} size={18} color="#fff" />
          <Text style={styles.toastText}>{msg}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ghostBtn: { height: 44 },
  secondaryBorder: { borderWidth: 1, borderColor: colors.border },
  btnContent: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnLabel: { fontFamily: fonts.semibold, fontSize: fontSize.lg },

  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipDefault: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.brandPrimary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.base },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.onSurface, textAlign: "center" },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.onSurfaceTertiary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    zIndex: 9999,
  },
  toastText: { color: "#fff", fontFamily: fonts.medium, fontSize: fontSize.base, flex: 1 },
});
