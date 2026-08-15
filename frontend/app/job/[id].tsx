import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Application, Job } from "@/src/api/client";
import { AiTools } from "@/src/components/AiTools";
import { CompanyLogo } from "@/src/components/CompanyLogo";
import { Button, Skeleton, useToast } from "@/src/components/ui";
import { colors, EXPERIENCE_LABEL, fonts, fontSize, radius, REMOTE_LABEL, spacing, formatSalary } from "@/src/theme";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [j, apps] = await Promise.all([api.getJob(id), api.listApplications()]);
      setJob(j);
      setApp(apps.find((a) => a.job_id === id) ?? null);
    } catch {
      toast.show("Could not load job", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async () => {
    if (!job) return;
    setBusy(true);
    try {
      if (app) {
        await api.deleteApplication(app.application_id);
        setApp(null);
        toast.show("Removed from tracker");
      } else {
        const created = await api.createApplication(job.job_id, "Saved");
        setApp(created);
        toast.show("Saved to tracker", "success");
      }
    } catch {
      toast.show("Could not update", "error");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!job) return;
    setBusy(true);
    try {
      let current = app;
      if (!current) current = await api.createApplication(job.job_id, "Applied");
      else current = await api.updateApplication(current.application_id, { status: "Applied" });
      setApp(current);
      toast.show("Marked as applied", "success");
      if (job.url) Linking.openURL(job.url).catch(() => {});
    } catch {
      toast.show("Could not apply", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Floating back button */}
      <Pressable
        testID="back-button"
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + spacing.sm }]}
      >
        <Feather name="arrow-left" size={22} color={colors.onSurface} />
      </Pressable>

      {loading ? (
        <View style={{ paddingTop: insets.top + 80, paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Skeleton height={64} width={64} style={{ borderRadius: radius.lg, alignSelf: "center" }} />
          <Skeleton height={24} width="70%" style={{ alignSelf: "center" }} />
          <Skeleton height={16} width="90%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="85%" />
        </View>
      ) : job ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 130 }}
          >
            {/* Hero */}
            <LinearGradient colors={[colors.brandTertiary, colors.surface]} style={[styles.hero, { paddingTop: insets.top + 72 }]}>
              <View style={styles.logoWrap}>
                <CompanyLogo uri={job.company_logo} name={job.company} logoStyle={styles.logo} textStyle={styles.logoFallback} />
              </View>
              <Text style={styles.company}>{job.company}</Text>
              <Text style={styles.title}>{job.title}</Text>
              <View style={styles.remoteBadge}>
                <Feather name="wifi" size={13} color={colors.onBrandSecondary} />
                <Text style={styles.remoteBadgeText}>{REMOTE_LABEL[job.remote_type]}</Text>
              </View>
            </LinearGradient>

            {/* Quick facts */}
            <View style={styles.facts}>
              <Fact icon="dollar-sign" label="Salary" value={formatSalary(job.salary_min, job.salary_max)} />
              <View style={styles.factDivider} />
              <Fact icon="map-pin" label="Location" value={job.location || "—"} />
              <View style={styles.factDivider} />
              <Fact icon="trending-up" label="Level" value={EXPERIENCE_LABEL[job.experience_level]} />
            </View>

            {job.tags.length > 0 && (
              <View style={styles.tagRow}>
                {job.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About the role</Text>
              <Text style={styles.description}>{job.description}</Text>
            </View>

            <AiTools jobId={job.job_id} />

            {app && (
              <View style={styles.statusBanner} testID="status-banner">
                <Feather name="check-circle" size={16} color={colors.brandPrimary} />
                <Text style={styles.statusBannerText}>In your tracker · {app.status}</Text>
              </View>
            )}
          </ScrollView>

          {/* Sticky CTA */}
          <BlurView
            intensity={Platform.OS === "ios" ? 40 : 0}
            tint="light"
            style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: Platform.OS === "ios" ? "rgba(252,252,250,0.7)" : colors.surface }]}
          >
            <Button
              label={app ? "Saved" : "Save"}
              icon={app ? "bookmark" : "bookmark"}
              variant="secondary"
              onPress={toggleSave}
              disabled={busy}
              style={{ flex: 1 }}
              testID="save-button"
            />
            <Button
              label="Apply now"
              variant="primary"
              onPress={apply}
              loading={busy}
              style={{ flex: 1.4 }}
              testID="apply-button"
            />
          </BlurView>
        </>
      ) : (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Job not found</Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      )}
    </View>
  );
}

function Fact({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={16} color={colors.brandPrimary} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(252,252,250,0.9)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { alignItems: "center", paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  logo: { width: 48, height: 48 },
  logoFallback: { fontFamily: fonts.bold, fontSize: 28, color: colors.onSurfaceSecondary },
  company: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface, textAlign: "center", marginTop: 4, letterSpacing: -0.5 },
  remoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  remoteBadgeText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onBrandSecondary },
  facts: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "flex-start",
  },
  fact: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 4 },
  factDivider: { width: 1, backgroundColor: colors.border, alignSelf: "stretch" },
  factLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurfaceTertiary, marginTop: 2 },
  factValue: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface, textAlign: "center" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tag: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  tagText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onBrandTertiary },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.onSurface, marginBottom: spacing.sm },
  description: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.onSurfaceSecondary, lineHeight: 24 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
  },
  statusBannerText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onBrandTertiary },
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  notFoundText: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.onSurface },
});
