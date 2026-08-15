import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, ApiError, MatchResult, Resume } from "@/src/api/client";
import { Button, useToast } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export function AiTools({ jobId }: { jobId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [busyMatch, setBusyMatch] = useState(false);
  const [busyLetter, setBusyLetter] = useState(false);

  useEffect(() => {
    api
      .listResumes()
      .then((list) => {
        setResumes(list);
        const def = list.find((r) => r.is_default) ?? list[0];
        setResumeId(def?.resume_id ?? null);
      })
      .catch(() => setResumes([]));
  }, []);

  const runMatch = async () => {
    if (busyMatch) return;
    setBusyMatch(true);
    setMatch(null);
    try {
      const result = await api.aiMatch(jobId, resumeId);
      setMatch(result);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Match analysis failed", "error");
    } finally {
      setBusyMatch(false);
    }
  };

  const runLetter = async () => {
    if (busyLetter) return;
    setBusyLetter(true);
    setLetter(null);
    try {
      const result = await api.aiCoverLetter(jobId, resumeId);
      setLetter(result.cover_letter);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Cover letter failed", "error");
    } finally {
      setBusyLetter(false);
    }
  };

  const copyLetter = async () => {
    if (!letter) return;
    await Clipboard.setStringAsync(letter);
    toast.show("Cover letter copied", "success");
  };

  const scoreColor = (s: number) => (s >= 70 ? colors.success : s >= 40 ? colors.warning : colors.error);

  return (
    <View style={styles.container} testID="ai-tools">
      <View style={styles.titleRow}>
        <View style={styles.sparkle}>
          <Feather name="zap" size={16} color={colors.brandPrimary} />
        </View>
        <Text style={styles.title}>AI Assistant</Text>
      </View>

      {resumes === null ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.lg }} />
      ) : resumes.length === 0 ? (
        <View style={styles.emptyCard} testID="ai-no-resume">
          <Feather name="file-text" size={22} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyText}>
            Add a resume to unlock match scoring and tailored cover letters.
          </Text>
          <Button
            label="Add resume"
            variant="secondary"
            onPress={() => router.push("/(tabs)/resumes")}
            style={{ height: 44 }}
            testID="ai-add-resume"
          />
        </View>
      ) : (
        <>
          {resumes.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resumeRow}>
              {resumes.map((r) => {
                const active = r.resume_id === resumeId;
                return (
                  <Pressable
                    key={r.resume_id}
                    testID={`ai-resume-${r.resume_id}`}
                    onPress={() => setResumeId(r.resume_id)}
                    style={[styles.resumeChip, active && styles.resumeChipActive]}
                  >
                    <Feather name="file-text" size={13} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
                    <Text style={[styles.resumeChipText, active && { color: colors.onBrandPrimary }]}>
                      {r.version_name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.btnRow}>
            <Button
              label="Match score"
              icon="target"
              variant="secondary"
              onPress={runMatch}
              loading={busyMatch}
              style={{ flex: 1, height: 48 }}
              testID="ai-match-button"
            />
            <Button
              label="Cover letter"
              icon="edit-3"
              variant="secondary"
              onPress={runLetter}
              loading={busyLetter}
              style={{ flex: 1, height: 48 }}
              testID="ai-letter-button"
            />
          </View>

          {busyMatch && <Text style={styles.working}>Analyzing your resume against this role…</Text>}
          {busyLetter && <Text style={styles.working}>Writing your tailored cover letter…</Text>}

          {match && (
            <View style={styles.resultCard} testID="ai-match-result">
              <View style={styles.scoreRow}>
                <View style={[styles.scoreRing, { borderColor: scoreColor(match.score) }]}>
                  <Text style={[styles.scoreText, { color: scoreColor(match.score) }]}>{match.score}</Text>
                  <Text style={styles.scorePct}>%</Text>
                </View>
                <Text style={styles.summary}>{match.summary}</Text>
              </View>
              {match.strengths.length > 0 && (
                <View style={styles.listBlock}>
                  <Text style={styles.listTitle}>Strengths</Text>
                  {match.strengths.map((s, i) => (
                    <View key={i} style={styles.listItem}>
                      <Feather name="check-circle" size={14} color={colors.success} style={{ marginTop: 2 }} />
                      <Text style={styles.listText}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
              {match.gaps.length > 0 && (
                <View style={styles.listBlock}>
                  <Text style={styles.listTitle}>Gaps to address</Text>
                  {match.gaps.map((g, i) => (
                    <View key={i} style={styles.listItem}>
                      <Feather name="alert-triangle" size={14} color={colors.warning} style={{ marginTop: 2 }} />
                      <Text style={styles.listText}>{g}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {letter && (
            <View style={styles.resultCard} testID="ai-letter-result">
              <View style={styles.letterHeader}>
                <Text style={styles.listTitle}>Your cover letter</Text>
                <Pressable testID="ai-copy-letter" onPress={copyLetter} style={styles.copyBtn}>
                  <Feather name="copy" size={14} color={colors.brandPrimary} />
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
              </View>
              <Text style={styles.letterText}>{letter}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    gap: spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sparkle: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.semibold, fontSize: fontSize.xl, color: colors.onSurface },
  emptyCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  resumeRow: { gap: spacing.sm },
  resumeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resumeChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  resumeChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  btnRow: { flexDirection: "row", gap: spacing.sm },
  working: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onBrandTertiary, textAlign: "center" },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  scoreRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scoreText: { fontFamily: fonts.bold, fontSize: 26 },
  scorePct: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginTop: 8 },
  summary: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 20 },
  listBlock: { gap: spacing.sm },
  listTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface },
  listItem: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  listText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurfaceSecondary, lineHeight: 20 },
  letterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, padding: spacing.xs },
  copyText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.brandPrimary },
  letterText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 22 },
});
