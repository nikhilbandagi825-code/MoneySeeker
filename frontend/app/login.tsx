import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import { Button, useToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1619732426274-4c7a677cd6af?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwd2FybSUyMHNhbmQlMjB0ZXh0dXJlJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODY4MDI3NTZ8MA&ixlib=rb-4.1.0&q=85";
const GOOGLE_LOGO = "https://developers.google.com/identity/images/g-logo.png";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, loginEmail, registerEmail, loginGoogle } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(tabs)/search" />;

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.show("Enter your email and password", "error");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await registerEmail(email, password, name);
      else await loginEmail(email, password);
      router.replace("/(tabs)/search");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      toast.show(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      await loginGoogle();
    } catch {
      toast.show("Google sign-in failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageBackground source={{ uri: BG_IMAGE }} style={styles.bg}>
      <LinearGradient
        colors={["rgba(252,252,250,0.72)", "rgba(252,252,250,0.9)", "rgba(252,252,250,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandWrap}>
          <View style={styles.logoBadge}>
            <Feather name="briefcase" size={26} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>MoneySeeker</Text>
          <Text style={styles.tagline}>Find work. Track everything. Land the offer.</Text>
        </View>

        <View style={styles.form}>
          {mode === "register" && (
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={colors.onSurfaceTertiary} />
              <TextInput
                testID="name-input"
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}
          <View style={styles.inputWrap}>
            <Feather name="mail" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>
          <View style={styles.inputWrap}>
            <Feather name="lock" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
              secureTextEntry={!showPw}
            />
            <Pressable hitSlop={10} onPress={() => setShowPw((s) => !s)} testID="toggle-password">
              <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>

          <Button
            label={mode === "login" ? "Continue" : "Create account"}
            onPress={submit}
            loading={busy}
            testID="submit-auth-button"
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable testID="google-signin-button" onPress={google} disabled={busy} style={styles.googleBtn}>
            <Image source={{ uri: GOOGLE_LOGO }} style={styles.googleLogo} contentFit="contain" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
        </View>

        <Pressable
          testID="toggle-auth-mode"
          onPress={() => setMode((m) => (m === "login" ? "register" : "login"))}
          style={styles.switchRow}
        >
          <Text style={styles.switchText}>
            {mode === "login" ? "New here? " : "Already have an account? "}
            <Text style={styles.switchLink}>{mode === "login" ? "Create an account" : "Sign in"}</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "center" },
  brandWrap: { alignItems: "center", marginBottom: spacing.xxl },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  brand: { fontFamily: fonts.bold, fontSize: fontSize.xxxl, color: colors.onSurface, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: spacing.xs, textAlign: "center" },
  form: { gap: spacing.md },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 54,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.onSurface },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  googleLogo: { width: 20, height: 20 },
  googleText: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  switchRow: { alignItems: "center", marginTop: spacing.xl },
  switchText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  switchLink: { fontFamily: fonts.semibold, color: colors.brandPrimary },
});
