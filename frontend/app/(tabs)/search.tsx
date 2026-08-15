import { Feather } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Job, JobFilters } from "@/src/api/client";
import { FilterSheet } from "@/src/components/FilterSheet";
import { JobCard } from "@/src/components/JobCard";
import { Chip, EmptyState, Skeleton, useToast } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

const QUICK_FILTERS: { label: string; patch: JobFilters }[] = [
  { label: "Remote", patch: { remote_type: "remote" } },
  { label: "$100k+", patch: { salary_min: 100000 } },
  { label: "Senior", patch: { experience_level: "senior" } },
  { label: "Entry level", patch: { experience_level: "entry" } },
  { label: "Design", patch: { q: "Design" } },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const sheetRef = useRef<BottomSheetModal>(null);

  const [filters, setFilters] = useState<JobFilters>({});
  const [searchText, setSearchText] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const seeded = useRef(false);
  const syncedLive = useRef(false);

  const loadJobs = useCallback(
    async (f: JobFilters) => {
      setError(false);
      try {
        let list = await api.searchJobs(f);
        if (list.length === 0 && Object.keys(f).length === 0 && !seeded.current) {
          seeded.current = true;
          await api.seedJobs();
          list = await api.searchJobs(f);
        }
        setJobs(list);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  const loadSaved = useCallback(async () => {
    try {
      const apps = await api.listApplications();
      const map: Record<string, string> = {};
      apps.forEach((a) => (map[a.job_id] = a.application_id));
      setSavedMap(map);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  useFocusEffect(
    useCallback(() => {
      loadJobs(filters);
      // one-time background sync of live listings (Remotive), then silent reload
      if (!syncedLive.current) {
        syncedLive.current = true;
        api
          .syncJobs()
          .then((r) => {
            if (r.synced > 0) loadJobs(filters);
          })
          .catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const applyFilters = (f: JobFilters) => {
    setFilters(f);
    setSearchText(f.q ?? "");
    setLoading(true);
    loadJobs(f);
  };

  const onSubmitSearch = () => {
    const f = { ...filters, q: searchText.trim() || undefined };
    setFilters(f);
    setLoading(true);
    // pull matching live listings first, then show results
    (f.q ? api.syncJobs(f.q).catch(() => {}) : Promise.resolve()).then(() => loadJobs(f));
  };

  const toggleQuick = (patch: JobFilters) => {
    const key = Object.keys(patch)[0] as keyof JobFilters;
    const active = filters[key] === patch[key];
    const next = { ...filters };
    if (active) delete next[key];
    else Object.assign(next, patch);
    applyFilters(next);
  };

  const isQuickActive = (patch: JobFilters) => {
    const key = Object.keys(patch)[0] as keyof JobFilters;
    return filters[key] === patch[key];
  };

  const activeFilterCount = Object.keys(filters).length;

  const toggleSave = async (job: Job) => {
    const appId = savedMap[job.job_id];
    try {
      if (appId) {
        await api.deleteApplication(appId);
        setSavedMap((m) => {
          const n = { ...m };
          delete n[job.job_id];
          return n;
        });
        toast.show("Removed from tracker");
      } else {
        const app = await api.createApplication(job.job_id, "Saved");
        setSavedMap((m) => ({ ...m, [job.job_id]: app.application_id }));
        toast.show("Saved to tracker", "success");
      }
    } catch {
      toast.show("Could not update", "error");
    }
  };

  const clearAll = () => applyFilters({});

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.hi}>Hi, {user?.name?.split(" ")[0] || "there"} 👋</Text>
            <Text style={styles.title}>Find your next role</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="search-input"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={onSubmitSearch}
              returnKeyType="search"
              placeholder="Role, company, or keyword"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.searchInput}
            />
            {searchText.length > 0 && (
              <Pressable hitSlop={8} onPress={() => { setSearchText(""); applyFilters({ ...filters, q: undefined }); }} testID="clear-search">
                <Feather name="x" size={16} color={colors.onSurfaceTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable testID="open-filters-button" style={styles.filterBtn} onPress={() => sheetRef.current?.present()}>
            <Feather name="sliders" size={20} color={colors.onSurface} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
          style={styles.pillScroll}
        >
          {QUICK_FILTERS.map((qf) => (
            <Chip
              key={qf.label}
              label={qf.label}
              selected={isQuickActive(qf.patch)}
              onPress={() => toggleQuick(qf.patch)}
              testID={`quick-${qf.label}`}
            />
          ))}
        </ScrollView>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <Skeleton height={48} width={48} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton height={12} width="40%" />
                  <Skeleton height={16} width="80%" />
                </View>
              </View>
              <Skeleton height={12} width="60%" style={{ marginTop: 14 }} />
            </View>
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="wifi-off"
          title="Something went wrong"
          subtitle="We couldn't load jobs. Pull to retry."
          ctaLabel="Retry"
          onCta={() => { setLoading(true); loadJobs(filters); }}
          testID="error-state"
        />
      ) : (
        <FlatList
          testID="jobs-list"
          data={jobs}
          keyExtractor={(item) => item.job_id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                api
                  .syncJobs(filters.q)
                  .catch(() => {})
                  .then(() => {
                    loadJobs(filters);
                    loadSaved();
                  });
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListHeaderComponent={
            jobs.length > 0 ? <Text style={styles.resultCount}>{jobs.length} jobs found</Text> : null
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              saved={!!savedMap[item.job_id]}
              onPress={() => router.push(`/job/${item.job_id}`)}
              onToggleSave={() => toggleSave(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="No jobs match your criteria"
              subtitle="Try adjusting your filters or search terms."
              ctaLabel="Clear filters"
              onCta={clearAll}
              testID="empty-state"
            />
          }
        />
      )}

      <FilterSheet ref={sheetRef} initial={filters} onApply={applyFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  hi: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceTertiary },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.onSurface },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: colors.onBrandPrimary, fontFamily: fonts.bold, fontSize: 11 },
  pillScroll: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  pillRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  listContent: { padding: spacing.lg, gap: spacing.md },
  resultCount: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.md },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
});
