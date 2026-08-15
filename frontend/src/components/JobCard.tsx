import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Job } from "@/src/api/client";
import { CompanyLogo } from "@/src/components/CompanyLogo";
import { colors, fonts, fontSize, radius, REMOTE_LABEL, spacing, formatSalary } from "@/src/theme";

export function JobCard({
  job,
  saved,
  onPress,
  onToggleSave,
}: {
  job: Job;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  return (
    <Pressable
      testID={`job-card-${job.job_id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.logoWrap}>
          <CompanyLogo uri={job.company_logo} name={job.company} logoStyle={styles.logo} textStyle={styles.logoFallback} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.company}>{job.company}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
        </View>
        <Pressable
          testID={`bookmark-${job.job_id}`}
          hitSlop={10}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onToggleSave();
          }}
          style={styles.bookmark}
        >
          <Feather
            name="bookmark"
            size={20}
            color={saved ? colors.brandPrimary : colors.onSurfaceTertiary}
            style={saved ? undefined : { opacity: 0.8 }}
          />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Feather name="map-pin" size={13} color={colors.onSurfaceTertiary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {job.location || REMOTE_LABEL[job.remote_type]}
          </Text>
        </View>
        <View style={styles.dot} />
        <View style={styles.metaItem}>
          <Feather name="dollar-sign" size={13} color={colors.onSurfaceTertiary} />
          <Text style={styles.metaText}>{formatSalary(job.salary_min, job.salary_max)}</Text>
        </View>
      </View>

      <View style={styles.tagRow}>
        {job.source === "remotive" && (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
        )}
        <View style={styles.remotePill}>
          <Text style={styles.remotePillText}>{REMOTE_LABEL[job.remote_type]}</Text>
        </View>
        {job.tags.slice(0, 2).map((t) => (
          <View key={t} style={styles.tag}>
            <Text style={styles.tagText}>{t}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 32, height: 32 },
  logoFallback: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurfaceSecondary },
  company: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 2, lineHeight: 21 },
  bookmark: { padding: spacing.xs },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  metaText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  remotePill: { backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm },
  remotePillText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onBrandSecondary },
  tag: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm },
  tagText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DDEEE1",
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  livePillText: { fontFamily: fonts.semibold, fontSize: 11, color: "#2C4533", letterSpacing: 0.5 },
});
