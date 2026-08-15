import { Feather } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import dayjs from "dayjs";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  scrollTo,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Application } from "@/src/api/client";
import { ApplicationSheet } from "@/src/components/ApplicationSheet";
import { CompanyLogo } from "@/src/components/CompanyLogo";
import { Skeleton, useToast } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing, STATUS_COLOR, STATUS_ORDER } from "@/src/theme";

const SCREEN_W = Dimensions.get("window").width;
const COL_W = Math.min(SCREEN_W * 0.78, 320);
const GAP = spacing.md;
const H_PAD = spacing.lg;
const EDGE_ZONE = 70;
const NUM_COLS = STATUS_ORDER.length;

function colIndexForX(scrollXVal: number, absX: number): number {
  "worklet";
  const raw = Math.floor((scrollXVal + absX - H_PAD) / (COL_W + GAP));
  return Math.max(0, Math.min(NUM_COLS - 1, raw));
}

interface DragShared {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  active: SharedValue<number>;
  scrollX: SharedValue<number>;
  targetCol: SharedValue<number>;
}

function CardBody({ app }: { app: Application }) {
  const overdue = app.follow_up_date && dayjs(app.follow_up_date).isBefore(dayjs(), "day");
  return (
    <>
      <View style={styles.cardTop}>
        <View style={styles.logoWrap}>
          <CompanyLogo
            uri={app.job?.company_logo}
            name={app.job?.company}
            logoStyle={styles.logo}
            textStyle={styles.logoFallback}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardCompany} numberOfLines={1}>{app.job?.company}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{app.job?.title}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        {app.follow_up_date && (
          <View style={[styles.metaPill, { backgroundColor: overdue ? "#F6E1E1" : "#FBEFD8" }]}>
            <Feather name="bell" size={11} color={overdue ? "#8A3232" : "#8A5E1B"} />
            <Text style={[styles.metaPillText, { color: overdue ? "#8A3232" : "#8A5E1B" }]}>
              {dayjs(app.follow_up_date).format("MMM D")}
            </Text>
          </View>
        )}
        {app.notes.length > 0 && (
          <View style={styles.metaPlain}>
            <Feather name="message-square" size={11} color={colors.onSurfaceTertiary} />
            <Text style={styles.metaPlainText}>{app.notes.length}</Text>
          </View>
        )}
        <View style={styles.metaPlain}>
          <Feather name="clock" size={11} color={colors.onSurfaceTertiary} />
          <Text style={styles.metaPlainText}>{dayjs(app.updated_at).format("MMM D")}</Text>
        </View>
      </View>
    </>
  );
}

function DraggableCard({
  app,
  dimmed,
  shared,
  onLift,
  onRelease,
  onTap,
}: {
  app: Application;
  dimmed: boolean;
  shared: DragShared;
  onLift: (app: Application) => void;
  onRelease: (colIdx: number) => void;
  onTap: (app: Application) => void;
}) {
  const { dragX, dragY, active, scrollX, targetCol } = shared;
  const pan = Gesture.Pan()
    .activateAfterLongPress(280)
    .onStart((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      targetCol.value = colIndexForX(scrollX.value, e.absoluteX);
      active.value = 1;
      runOnJS(onLift)(app);
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      targetCol.value = colIndexForX(scrollX.value, e.absoluteX);
    })
    .onFinalize(() => {
      if (active.value === 1) {
        active.value = 0;
        runOnJS(onRelease)(targetCol.value);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Pressable
        testID={`tracker-card-${app.application_id}`}
        onPress={() => onTap(app)}
        style={({ pressed }) => [styles.card, dimmed && { opacity: 0.3 }, pressed && !dimmed && { opacity: 0.92 }]}
      >
        <CardBody app={app} />
      </Pressable>
    </GestureDetector>
  );
}

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const sheetRef = useRef<BottomSheetModal>(null);

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragApp, setDragApp] = useState<Application | null>(null);
  const [targetIdx, setTargetIdx] = useState(-1);
  const dragAppRef = useRef<Application | null>(null);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const active = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const targetCol = useSharedValue(-1);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const shared: DragShared = { dragX, dragY, active, scrollX, targetCol };

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  useAnimatedReaction(
    () => targetCol.value,
    (v, prev) => {
      if (v !== prev) runOnJS(setTargetIdx)(v);
    },
  );

  // Auto-scroll the board while a card is held near a screen edge.
  useFrameCallback(() => {
    if (active.value !== 1) return;
    const maxScroll = NUM_COLS * (COL_W + GAP) + H_PAD * 2 - SCREEN_W;
    if (dragX.value > SCREEN_W - EDGE_ZONE) {
      scrollTo(scrollRef, Math.min(maxScroll, scrollX.value + 10), 0, false);
    } else if (dragX.value < EDGE_ZONE) {
      scrollTo(scrollRef, Math.max(0, scrollX.value - 10), 0, false);
    }
  });

  const load = useCallback(async () => {
    try {
      const list = await api.listApplications();
      setApps(list);
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

  const onLift = useCallback((app: Application) => {
    dragAppRef.current = app;
    setDragApp(app);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const onRelease = useCallback(
    (colIdx: number) => {
      const a = dragAppRef.current;
      dragAppRef.current = null;
      setDragApp(null);
      setTargetIdx(-1);
      targetCol.value = -1;
      if (!a || colIdx < 0 || colIdx >= NUM_COLS) return;
      const newStatus = STATUS_ORDER[colIdx];
      if (newStatus === a.status) return;

      setApps((prev) =>
        prev.map((x) => (x.application_id === a.application_id ? { ...x, status: newStatus } : x)),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      api
        .updateApplication(a.application_id, { status: newStatus })
        .then((updated) =>
          setApps((prev) =>
            prev.map((x) => (x.application_id === updated.application_id ? updated : x)),
          ),
        )
        .catch(() => {
          setApps((prev) =>
            prev.map((x) => (x.application_id === a.application_id ? { ...x, status: a.status } : x)),
          );
          toast.show("Could not move card", "error");
        });
    },
    [targetCol, toast],
  );

  const onTap = useCallback((app: Application) => {
    setSelectedId(app.application_id);
    sheetRef.current?.present();
  }, []);

  const selected = apps.find((a) => a.application_id === selectedId) ?? null;

  const onSheetChange = useCallback((updated: Application) => {
    setApps((prev) => prev.map((x) => (x.application_id === updated.application_id ? updated : x)));
  }, []);

  const onSheetRemove = useCallback((id: string) => {
    setApps((prev) => prev.filter((x) => x.application_id !== id));
    setSelectedId(null);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: active.value === 1 ? 1 : 0,
    transform: [
      { translateX: dragX.value - (COL_W - spacing.md * 2) / 2 },
      { translateY: dragY.value - 70 },
    ],
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Application Tracker</Text>
          <Pressable
            testID="tracker-refresh"
            hitSlop={8}
            onPress={() => {
              setLoading(true);
              load();
            }}
            style={styles.refreshBtn}
          >
            <Feather name="refresh-cw" size={17} color={colors.onSurfaceSecondary} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Hold & drag cards between stages · tap for notes</Text>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", gap: GAP, padding: H_PAD }}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.column, { width: COL_W, height: 400 }]}>
              <View style={{ padding: spacing.md, gap: spacing.md }}>
                <Skeleton height={18} width="50%" />
                <Skeleton height={90} />
                <Skeleton height={90} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          testID="kanban-board"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          snapToInterval={COL_W + GAP}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: H_PAD, gap: GAP, paddingBottom: insets.bottom + spacing.md }}
          style={{ flex: 1, marginTop: spacing.md }}
        >
          {STATUS_ORDER.map((status, idx) => {
            const cards = apps.filter((a) => a.status === status);
            const isTarget = dragApp !== null && targetIdx === idx;
            return (
              <View
                key={status}
                testID={`kanban-column-${status}`}
                style={[styles.column, { width: COL_W }, isTarget && styles.columnTarget]}
              >
                <View style={styles.colHeader}>
                  <View style={[styles.colDot, { backgroundColor: STATUS_COLOR[status].fg }]} />
                  <Text style={styles.colTitle}>{status}</Text>
                  <View style={styles.colCount}>
                    <Text style={styles.colCountText}>{cards.length}</Text>
                  </View>
                </View>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
                >
                  {cards.map((a) => (
                    <DraggableCard
                      key={a.application_id}
                      app={a}
                      dimmed={dragApp?.application_id === a.application_id}
                      shared={shared}
                      onLift={onLift}
                      onRelease={onRelease}
                      onTap={onTap}
                    />
                  ))}
                  {cards.length === 0 && (
                    <View style={[styles.dropZone, isTarget && styles.dropZoneActive]}>
                      <Feather name="inbox" size={18} color={colors.onSurfaceTertiary} />
                      <Text style={styles.dropZoneText}>
                        {dragApp ? "Drop here" : `No ${status.toLowerCase()} jobs`}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            );
          })}
        </Animated.ScrollView>
      )}

      {/* Floating drag ghost */}
      {dragApp && (
        <Animated.View pointerEvents="none" style={[styles.ghost, overlayStyle]}>
          <CardBody app={dragApp} />
        </Animated.View>
      )}

      <ApplicationSheet ref={sheetRef} app={selected} onChange={onSheetChange} onRemove={onSheetRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.onSurface, letterSpacing: -0.5 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  column: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  columnTarget: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.onSurface },
  colCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  colCountText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.onSurfaceSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 24, height: 24 },
  logoFallback: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.onSurfaceSecondary },
  cardCompany: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurfaceTertiary },
  cardTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.onSurface, lineHeight: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  metaPillText: { fontFamily: fonts.medium, fontSize: 11 },
  metaPlain: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaPlainText: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurfaceTertiary },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  dropZoneActive: { borderColor: colors.brandPrimary, backgroundColor: colors.surface },
  dropZoneText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.onSurfaceTertiary },
  ghost: {
    position: "absolute",
    top: 0,
    left: 0,
    width: COL_W - spacing.md * 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
