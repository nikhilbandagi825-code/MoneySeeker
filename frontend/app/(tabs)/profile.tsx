import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Button, useToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing, STATUS_ORDER } from "@/src/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ total: 0, applied: 0, interviewing: 0, resumes: 0 });

  const load = useCallback(async () => {
    try {
      const [apps, resumes] = await Promise.all([api.listApplications(), api.listResumes()]);
      setStats({
        total: apps.length,
        applied: apps.filter((a) => a.status === "Applied").length,
        interviewing: apps.filter((a) => a.status === "Interviewing").length,
        resumes: resumes.length,
      });
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const doLogout = async () => {
    await logout();
    toast.show("Signed out");
  };

  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={styles.name}>{user?.name || "Job Seeker"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.providerBadge}>
            <Feather name={user?.auth_provider === "google" ? "chrome" : "mail"} size={12} color={colors.onBrandTertiary} />
            <Text style={styles.providerText}>
              {user?.auth_provider === "google" ? "Google account" : "Email account"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Tracked" value={stats.total} />
          <Stat label="Applied" value={stats.applied} />
          <Stat label="Interviews" value={stats.interviewing} />
          <Stat label="Resumes" value={stats.resumes} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pipeline</Text>
          <View style={styles.pipelineCard}>
            {STATUS_ORDER.map((s, i) => (
              <View key={s} style={[styles.pipelineRow, i < STATUS_ORDER.length - 1 && styles.pipelineDivider]}>
                <Text style={styles.pipelineText}>{s}</Text>
                <View style={styles.pipelineDot}>
                  <Text style={styles.pipelineCount}>
                    {s === "Applied" ? stats.applied : s === "Interviewing" ? stats.interviewing : ""}
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.onSurfaceTertiary} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <Button label="Sign out" variant="secondary" icon="log-out" onPress={doLogout} testID="logout-button" />
        <Text style={styles.version}>MoneySeeker · v1.0</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  profileCard: { alignItems: "center", gap: spacing.xs },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontFamily: fonts.bold, fontSize: 36, color: colors.onBrandPrimary },
  name: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface },
  email: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceTertiary },
  providerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, marginTop: spacing.sm },
  providerText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onBrandTertiary },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", gap: 2 },
  statValue: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurfaceTertiary },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceTertiary },
  pipelineCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  pipelineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.lg },
  pipelineDivider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  pipelineText: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.onSurface },
  pipelineDot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pipelineCount: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  version: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, textAlign: "center" },
});
