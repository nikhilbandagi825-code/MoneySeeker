import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Application } from "@/src/api/client";
import { CompanyLogo } from "@/src/components/CompanyLogo";
import { EmptyState, Skeleton } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing, STATUS_COLOR, STATUS_ORDER } from "@/src/theme";

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [status, setStatus] = useState<string>("Saved");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listApplications();
      setApps(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = apps.filter((a) => a.status === s).length;
    return acc;
  }, {});

  const filtered = apps.filter((a) => a.status === status);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Application Tracker</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segRow}
          style={styles.segScroll}
        >
          {STATUS_ORDER.map((s) => {
            const active = status === s;
            return (
              <Pressable
                key={s}
                testID={`status-tab-${s}`}
                onPress={() => setStatus(s)}
                style={[styles.segTab, active && styles.segTabActive]}
              >
                <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}>
                  {s}
                </Text>
                <View style={[styles.countPill, { backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.surfaceTertiary }]}>
                  <Text style={[styles.countText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>
                    {counts[s]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={40} width={40} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton height={12} width="40%" />
                <Skeleton height={16} width="70%" />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          testID="tracker-list"
          data={filtered}
          keyExtractor={(item) => item.application_id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`tracker-card-${item.application_id}`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => router.push(`/job/${item.job_id}`)}
            >
              <View style={styles.logoWrap}>
                <CompanyLogo uri={item.job?.company_logo} name={item.job?.company} logoStyle={styles.logo} textStyle={styles.logoFallback} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardCompany}>{item.job?.company}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.job?.title}</Text>
                <View style={styles.cardMeta}>
                  <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[item.status].bg }]}>
                    <Text style={[styles.statusChipText, { color: STATUS_COLOR[item.status].fg }]}>{item.status}</Text>
                  </View>
                  {item.follow_up_date && (
                    <View style={styles.reminderPill}>
                      <Feather name="clock" size={12} color={colors.warning} />
                      <Text style={styles.reminderText}>{item.follow_up_date}</Text>
                    </View>
                  )}
                  {item.notes.length > 0 && (
                    <View style={styles.noteBadge}>
                      <Feather name="message-square" size={12} color={colors.onSurfaceTertiary} />
                      <Text style={styles.noteBadgeText}>{item.notes.length}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="folder"
              title={`Nothing in ${status}`}
              subtitle="Save jobs from Search and they'll show up here."
              ctaLabel="Find jobs"
              onCta={() => router.push("/(tabs)/search")}
              testID="tracker-empty"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5, marginBottom: spacing.md },
  segScroll: { marginHorizontal: -spacing.lg },
  segRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  segTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  segTabActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segText: { fontFamily: fonts.medium, fontSize: fontSize.base },
  countPill: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  countText: { fontFamily: fonts.semibold, fontSize: 11 },
  listContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  skeletonCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 28, height: 28 },
  logoFallback: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.onSurfaceSecondary },
  cardCompany: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  cardTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  statusChipText: { fontFamily: fonts.medium, fontSize: 12 },
  reminderPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FBEFD8", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  reminderText: { fontFamily: fonts.medium, fontSize: 12, color: "#8A5E1B" },
  noteBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  noteBadgeText: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurfaceTertiary },
});
