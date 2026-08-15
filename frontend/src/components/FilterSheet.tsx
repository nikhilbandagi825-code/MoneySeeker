import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import Slider from "@react-native-community/slider";
import React, { forwardRef, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JobFilters } from "@/src/api/client";
import { Button } from "@/src/components/ui";
import { colors, EXPERIENCE_LABEL, fonts, fontSize, radius, REMOTE_LABEL, spacing } from "@/src/theme";

const REMOTE_OPTS = ["remote", "onsite", "hybrid"];
const EXP_OPTS = ["intern", "entry", "mid", "senior", "lead"];

function Segmented({
  options,
  labels,
  value,
  onChange,
  testIDPrefix,
}: {
  options: string[];
  labels: Record<string, string>;
  value: string | null;
  onChange: (v: string | null) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.segWrap}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Text
            key={opt}
            testID={`${testIDPrefix}-${opt}`}
            onPress={() => onChange(active ? null : opt)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            {labels[opt]}
          </Text>
        );
      })}
    </View>
  );
}

export const FilterSheet = forwardRef<
  BottomSheetModal,
  { initial: JobFilters; onApply: (f: JobFilters) => void }
>(({ initial, onApply }, ref) => {
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["85%"], []);

  const [role, setRole] = useState(initial.q ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [remote, setRemote] = useState<string | null>(initial.remote_type ?? null);
  const [exp, setExp] = useState<string | null>(initial.experience_level ?? null);
  const [salaryMin, setSalaryMin] = useState(initial.salary_min ?? 0);

  const reset = () => {
    setRole("");
    setLocation("");
    setRemote(null);
    setExp(null);
    setSalaryMin(0);
  };

  const apply = () => {
    onApply({
      q: role.trim() || undefined,
      location: location.trim() || undefined,
      remote_type: remote ?? undefined,
      experience_level: exp ?? undefined,
      salary_min: salaryMin > 0 ? salaryMin : undefined,
    });
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
      )}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filters</Text>
        <Text testID="filter-reset" onPress={reset} style={styles.reset}>
          Reset
        </Text>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>Role / keyword</Text>
          <View style={styles.inputWrap}>
            <Feather name="search" size={16} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="filter-role-input"
              value={role}
              onChangeText={setRole}
              placeholder="e.g. React, Designer"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.inputWrap}>
            <Feather name="map-pin" size={16} color={colors.onSurfaceTertiary} />
            <TextInput
              testID="filter-location-input"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. New York, Remote"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Work type</Text>
          <Segmented options={REMOTE_OPTS} labels={REMOTE_LABEL} value={remote} onChange={setRemote} testIDPrefix="filter-remote" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Experience level</Text>
          <Segmented options={EXP_OPTS} labels={EXPERIENCE_LABEL} value={exp} onChange={setExp} testIDPrefix="filter-exp" />
        </View>

        <View style={styles.field}>
          <View style={styles.salaryHeader}>
            <Text style={styles.label}>Minimum salary</Text>
            <Text style={styles.salaryValue}>
              {salaryMin > 0 ? `$${Math.round(salaryMin / 1000)}k+` : "Any"}
            </Text>
          </View>
          <Slider
            testID="filter-salary-slider"
            minimumValue={0}
            maximumValue={250000}
            step={10000}
            value={salaryMin}
            onValueChange={setSalaryMin}
            minimumTrackTintColor={colors.brandPrimary}
            maximumTrackTintColor={colors.surfaceTertiary}
            thumbTintColor={colors.brandPrimary}
          />
        </View>
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Show results" onPress={apply} testID="filter-apply-button" />
      </View>
    </BottomSheetModal>
  );
});

FilterSheet.displayName = "FilterSheet";

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.onSurface },
  reset: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.brandPrimary },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.onSurface },
  segWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segItem: {
    fontFamily: fonts.medium,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  segItemActive: { backgroundColor: colors.brandPrimary, color: colors.onBrandPrimary, borderColor: colors.brandPrimary },
  salaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  salaryValue: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.brandPrimary },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
