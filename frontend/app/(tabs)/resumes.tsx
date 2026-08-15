import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Resume } from "@/src/api/client";
import { Button, EmptyState, useToast } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export default function ResumesScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    try {
      setResumes(await api.listResumes());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resetForm = () => {
    setName("");
    setContent("");
    setIsDefault(false);
    setAdding(false);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.show("Add a version name", "error");
      return;
    }
    setSaving(true);
    try {
      await api.createResume({ version_name: name.trim(), content: content.trim(), is_default: isDefault });
      toast.show("Resume saved", "success");
      resetForm();
      load();
    } catch {
      toast.show("Could not save resume", "error");
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (r: Resume) => {
    try {
      await api.updateResume(r.resume_id, { is_default: true });
      toast.show(`"${r.version_name}" set as default`, "success");
      load();
    } catch {
      toast.show("Could not update", "error");
    }
  };

  const remove = async (r: Resume) => {
    try {
      await api.deleteResume(r.resume_id);
      toast.show("Resume deleted");
      load();
    } catch {
      toast.show("Could not delete", "error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Resumes</Text>
        {!adding && (
          <Pressable testID="add-resume-button" style={styles.addBtn} onPress={() => setAdding(true)}>
            <Feather name="plus" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.addBtnText}>New</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {adding && (
          <View style={styles.formCard} testID="resume-form">
            <Text style={styles.formTitle}>New resume version</Text>
            <TextInput
              testID="resume-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Version name (e.g. Backend v2)"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <TextInput
              testID="resume-content-input"
              value={content}
              onChangeText={setContent}
              placeholder="Paste your resume text here (used later for AI job matching)…"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Set as default</Text>
              <Switch
                testID="resume-default-switch"
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.formActions}>
              <Button label="Cancel" variant="secondary" onPress={resetForm} style={{ flex: 1 }} testID="resume-cancel" />
              <Button label="Save" onPress={save} loading={saving} style={{ flex: 1 }} testID="resume-save" />
            </View>
          </View>
        )}

        {!loading && resumes.length === 0 && !adding ? (
          <EmptyState
            icon="file-text"
            title="No resumes yet"
            subtitle="Add your first resume version to use with applications and AI matching."
            ctaLabel="Add resume"
            onCta={() => setAdding(true)}
            testID="resumes-empty"
          />
        ) : (
          resumes.map((r) => (
            <View key={r.resume_id} style={styles.card} testID={`resume-card-${r.resume_id}`}>
              <View style={styles.cardTop}>
                <View style={styles.fileIcon}>
                  <Feather name="file-text" size={18} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.resumeName}>{r.version_name}</Text>
                    {r.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  {r.content ? (
                    <Text style={styles.preview} numberOfLines={2}>{r.content}</Text>
                  ) : (
                    <Text style={styles.previewEmpty}>No text added</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardActions}>
                {!r.is_default && (
                  <Pressable testID={`set-default-${r.resume_id}`} style={styles.actionBtn} onPress={() => makeDefault(r)}>
                    <Feather name="star" size={15} color={colors.onSurfaceSecondary} />
                    <Text style={styles.actionText}>Set default</Text>
                  </Pressable>
                )}
                <Pressable testID={`delete-resume-${r.resume_id}`} style={styles.actionBtn} onPress={() => remove(r)}>
                  <Feather name="trash-2" size={15} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addBtnText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onBrandPrimary },
  formCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  formTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  textarea: { height: 130, paddingTop: spacing.md },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  formActions: { flexDirection: "row", gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: "row", gap: spacing.md },
  fileIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resumeName: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  defaultBadge: { backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  defaultBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onBrandSecondary },
  preview: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginTop: 4, lineHeight: 19 },
  previewEmpty: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceTertiary, marginTop: 4, fontStyle: "italic" },
  cardActions: { flexDirection: "row", gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
});
