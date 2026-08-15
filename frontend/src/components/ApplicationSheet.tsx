import { Feather } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { forwardRef, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Application } from "@/src/api/client";
import { CompanyLogo } from "@/src/components/CompanyLogo";
import { useToast } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing, STATUS_COLOR, STATUS_ORDER } from "@/src/theme";

const REMINDER_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

// BottomSheetTextInput is incompatible with react-native-web (focus tracking API)
const NoteInput = Platform.OS === "web" ? TextInput : BottomSheetTextInput;

interface Props {
  app: Application | null;
  onChange: (updated: Application) => void;
  onRemove: (applicationId: string) => void;
}

export const ApplicationSheet = forwardRef<BottomSheetModal, Props>(
  ({ app, onChange, onRemove }, ref) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const toast = useToast();
    const snapPoints = useMemo(() => ["80%"], []);
    const [noteText, setNoteText] = useState("");
    const [busy, setBusy] = useState(false);

    const dismiss = () => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();

    const setStage = async (status: string) => {
      if (!app || app.status === status) return;
      onChange({ ...app, status: status as Application["status"] });
      try {
        const updated = await api.updateApplication(app.application_id, { status });
        onChange(updated);
      } catch {
        onChange(app);
        toast.show("Could not update stage", "error");
      }
    };

    const setReminder = async (days: number | null) => {
      if (!app) return;
      const date = days === null ? null : dayjs().add(days, "day").format("YYYY-MM-DD");
      try {
        const updated = await api.updateApplication(app.application_id, { follow_up_date: date });
        onChange(updated);
        toast.show(date ? `Reminder set for ${dayjs(date).format("MMM D")}` : "Reminder cleared", "success");
      } catch {
        toast.show("Could not set reminder", "error");
      }
    };

    const addNote = async () => {
      if (!app || !noteText.trim() || busy) return;
      setBusy(true);
      try {
        const updated = await api.addNote(app.application_id, noteText.trim());
        onChange(updated);
        setNoteText("");
      } catch {
        toast.show("Could not add note", "error");
      } finally {
        setBusy(false);
      }
    };

    const removeNote = async (noteId: string) => {
      if (!app) return;
      try {
        const updated = await api.deleteNote(app.application_id, noteId);
        onChange(updated);
      } catch {
        toast.show("Could not delete note", "error");
      }
    };

    const removeApplication = async () => {
      if (!app || busy) return;
      setBusy(true);
      try {
        await api.deleteApplication(app.application_id);
        dismiss();
        onRemove(app.application_id);
        toast.show("Removed from tracker");
      } catch {
        toast.show("Could not remove", "error");
      } finally {
        setBusy(false);
      }
    };

    const reminderIsToday = app?.follow_up_date
      ? dayjs(app.follow_up_date).isBefore(dayjs().add(1, "day"), "day")
      : false;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
        )}
      >
        {app && (
          <BottomSheetScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Job header */}
            <Pressable
              testID="sheet-job-header"
              style={styles.jobHeader}
              onPress={() => {
                dismiss();
                router.push(`/job/${app.job_id}`);
              }}
            >
              <View style={styles.logoWrap}>
                <CompanyLogo uri={app.job?.company_logo} name={app.job?.company} logoStyle={styles.logo} textStyle={styles.logoFallback} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.company}>{app.job?.company}</Text>
                <Text style={styles.jobTitle} numberOfLines={2}>{app.job?.title}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.onSurfaceTertiary} />
            </Pressable>

            {/* Stage */}
            <View style={styles.section}>
              <Text style={styles.label}>Stage</Text>
              <View style={styles.chipRow}>
                {STATUS_ORDER.map((s) => {
                  const active = app.status === s;
                  return (
                    <Pressable
                      key={s}
                      testID={`sheet-stage-${s}`}
                      onPress={() => setStage(s)}
                      style={[styles.stageChip, active && { backgroundColor: STATUS_COLOR[s].bg, borderColor: STATUS_COLOR[s].fg }]}
                    >
                      <Text style={[styles.stageChipText, active && { color: STATUS_COLOR[s].fg, fontFamily: fonts.semibold }]}>
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Follow-up reminder */}
            <View style={styles.section}>
              <Text style={styles.label}>Follow-up reminder</Text>
              {app.follow_up_date ? (
                <View style={[styles.reminderBanner, reminderIsToday && { backgroundColor: "#FBEFD8" }]}>
                  <Feather name="bell" size={16} color={reminderIsToday ? "#8A5E1B" : colors.brandPrimary} />
                  <Text style={[styles.reminderBannerText, reminderIsToday && { color: "#8A5E1B" }]}>
                    Follow up on {dayjs(app.follow_up_date).format("ddd, MMM D")}
                  </Text>
                  <Pressable testID="sheet-clear-reminder" hitSlop={8} onPress={() => setReminder(null)}>
                    <Feather name="x-circle" size={18} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.hint}>No reminder set — pick one below.</Text>
              )}
              <View style={styles.chipRow}>
                {REMINDER_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.label}
                    testID={`sheet-reminder-${opt.days}`}
                    onPress={() => setReminder(opt.days)}
                    style={styles.reminderChip}
                  >
                    <Feather name="clock" size={13} color={colors.onBrandTertiary} />
                    <Text style={styles.reminderChipText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Notes ({app.notes.length})</Text>
              <View style={styles.noteInputRow}>
                <NoteInput
                  testID="sheet-note-input"
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="e.g. Emailed recruiter, waiting to hear back"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  style={styles.noteInput}
                  multiline
                />
                <Pressable
                  testID="sheet-add-note"
                  onPress={addNote}
                  style={[styles.addNoteBtn, (!noteText.trim() || busy) && { opacity: 0.4 }]}
                >
                  <Feather name="arrow-up" size={18} color={colors.onBrandPrimary} />
                </Pressable>
              </View>
              {app.notes.slice().reverse().map((n) => (
                <View key={n.note_id} style={styles.noteCard} testID={`note-${n.note_id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteText}>{n.text}</Text>
                    <Text style={styles.noteDate}>{dayjs(n.created_at).format("MMM D, h:mm A")}</Text>
                  </View>
                  <Pressable testID={`delete-note-${n.note_id}`} hitSlop={8} onPress={() => removeNote(n.note_id)}>
                    <Feather name="trash-2" size={16} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Danger */}
            <Pressable testID="sheet-remove-application" onPress={removeApplication} style={styles.removeBtn}>
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={styles.removeBtnText}>Remove from tracker</Text>
            </Pressable>
          </BottomSheetScrollView>
        )}
      </BottomSheetModal>
    );
  },
);

ApplicationSheet.displayName = "ApplicationSheet";

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  logoWrap: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 30, height: 30 },
  logoFallback: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.onSurfaceSecondary },
  company: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  jobTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface, marginTop: 1 },
  section: { gap: spacing.sm },
  label: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stageChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageChipText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reminderBannerText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onBrandTertiary },
  reminderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  reminderChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onBrandTertiary },
  noteInputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  noteInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.onSurface,
  },
  addNoteBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noteText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 20 },
  noteDate: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurfaceTertiary, marginTop: 4 },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F0D5D5",
    backgroundColor: "#FBF3F3",
  },
  removeBtnText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.error },
});
