import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer, type VideoSource } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { EmptyState, Screen } from "../../src/components/ui";
import { flexFill, useScreenTopInset, webFlexScreen } from "../../src/lib/layout-constants";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { formatWeight, fromKg, tonnageFromKg, weightLabel, type WeightUnit } from "../../src/lib/units";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type TabKey = "summary" | "history" | "howTo" | "records";
type MetricKey = "weight" | "oneRm" | "volume";
type ChartPoint = { label: string; maxWeight: number; maxOneRm: number; volume: number };

type ExerciseHeroMedia = {
  id: string;
  type: "IMAGE" | "VIDEO";
  storageUrl: string;
  thumbnailUrl?: string | null;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "history", label: "History" },
  { key: "howTo", label: "How to" },
  { key: "records", label: "Records" },
];

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "weight", label: "Heaviest Weight" },
  { key: "oneRm", label: "One Rep Max" },
  { key: "volume", label: "Best Set Volume" },
];

const PR_LABELS: Record<string, string> = {
  MAX_WEIGHT: "Heaviest Weight",
  ESTIMATED_1RM: "One Rep Max",
  MAX_VOLUME: "Best Set Volume",
  MAX_REPS: "Most Reps",
  MAX_DURATION: "Longest Duration",
};

const PR_DISPLAY_ORDER = ["MAX_WEIGHT", "ESTIMATED_1RM", "MAX_VOLUME", "MAX_REPS", "MAX_DURATION"] as const;

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function prLabel(type: string): string {
  return PR_LABELS[type] ?? titleCase(type);
}

function formatRecordValue(type: string, value: number, unit: WeightUnit): string {
  if (type === "MAX_REPS") return `${Math.round(value)} reps`;
  if (type === "MAX_DURATION") return `${Math.round(value)} sec`;
  if (type === "MAX_VOLUME") {
    return `${Math.round(tonnageFromKg(value, unit)).toLocaleString()} ${weightLabel(unit)}`;
  }
  return `${formatWeight(value, unit)} ${weightLabel(unit)}`;
}

function metricValue(point: ChartPoint, metric: MetricKey, unit: WeightUnit): number {
  if (metric === "weight") return fromKg(point.maxWeight, unit);
  if (metric === "oneRm") return fromKg(point.maxOneRm, unit);
  return tonnageFromKg(point.volume, unit);
}

function metricUnit(metric: MetricKey, unit: WeightUnit): string {
  return metric === "volume" ? weightLabel(unit) : weightLabel(unit);
}

function buildMediaList(exercise: { media?: ExerciseHeroMedia[] }): ExerciseHeroMedia[] {
  return exercise.media ?? [];
}

function ExerciseMediaHero({ media, colors, styles }: {
  media?: ExerciseHeroMedia;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const videoSource: VideoSource = media?.type === "VIDEO" ? { uri: media.storageUrl, useCaching: true } : null;
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = true;
    if (media?.type === "VIDEO") {
      instance.play();
    }
  });

  if (media?.type === "VIDEO") {
    return (
      <View style={styles.mediaHero}>
        <VideoView
          player={player}
          style={styles.mediaVideo}
          nativeControls
          contentFit="contain"
          allowsFullscreen
        />
      </View>
    );
  }

  if (media?.storageUrl) {
    return (
      <View style={styles.mediaHero}>
        <Image
          source={{ uri: media.storageUrl }}
          style={styles.mediaImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={180}
        />
      </View>
    );
  }

  return (
    <View style={styles.mediaHero}>
      <View style={styles.mediaEmpty}>
        <Ionicons name="barbell-outline" size={54} color={colors.textDim} />
      </View>
    </View>
  );
}

function MediaRail({ media, activeId, onSelect, styles, colors }: {
  media: ExerciseHeroMedia[];
  activeId?: string;
  onSelect: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  if (media.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>
      {media.slice(0, 8).map((item, index) => {
        const active = item.id === activeId;
        const imageUrl = item.type === "VIDEO" ? item.thumbnailUrl : item.storageUrl;
        return (
          <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.mediaThumb, active && styles.mediaThumbActive]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.mediaThumbImage} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={styles.mediaThumbEmpty}>
                <Ionicons name={item.type === "VIDEO" ? "play" : "image-outline"} size={16} color={colors.textMuted} />
              </View>
            )}
            {item.type === "VIDEO" ? (
              <View style={styles.mediaThumbBadge}>
                <Ionicons name="play" size={10} color={colors.onAccent} />
              </View>
            ) : null}
            <Text style={[styles.mediaThumbIndex, active && styles.mediaThumbIndexActive]}>{index + 1}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TrendChart({ data, metric, unit, colors, styles }: {
  data: ChartPoint[];
  metric: MetricKey;
  unit: WeightUnit;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - spacing.lg * 2 - 34, 220);
  const height = 172;
  const values = data.map((point) => metricValue(point, metric, unit));
  const hasData = values.some((value) => value > 0);

  if (data.length === 0 || !hasData) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons name="analytics-outline" size={28} color={colors.textDim} />
        <Text style={styles.emptyChartText}>Log a workout with this exercise to see progress</Text>
      </View>
    );
  }

  const max = Math.max(...values);
  const min = 0;
  const range = max - min || 1;
  const padX = 18;
  const padY = 20;
  const innerW = chartWidth - padX * 2;
  const innerH = height - padY * 2;
  const points = values.map((value, index) => ({
    x: padX + (values.length > 1 ? (index / (values.length - 1)) * innerW : innerW / 2),
    y: padY + (1 - (value - min) / range) * innerH,
    value,
  }));

  const formatAxis = (value: number) => {
    if (metric === "volume") return Math.round(value).toLocaleString();
    const rounded = Math.round(value * 10) / 10;
    return String(rounded);
  };

  return (
    <View style={styles.chartCanvas}>
      <View style={styles.axisLabels}>
        <Text style={styles.axisText}>{formatAxis(max)}</Text>
        <Text style={styles.axisText}>{formatAxis(max / 2)}</Text>
        <Text style={styles.axisText}>{formatAxis(min)}</Text>
      </View>
      <View style={[styles.chartPlot, { width: chartWidth, height }]}>
        {[0, 0.5, 1].map((line) => (
          <View key={line} style={[styles.gridLine, { top: padY + line * innerH }]} />
        ))}
        {points.map((point, index) => {
          const next = points[index + 1];
          const segment = next
            ? (() => {
                const dx = next.x - point.x;
                const dy = next.y - point.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                return (
                  <View
                    key={`seg-${index}`}
                    style={[
                      styles.chartSegment,
                      {
                        left: (point.x + next.x) / 2 - len / 2,
                        top: (point.y + next.y) / 2 - 1.5,
                        width: len,
                        transform: [{ rotate: `${angle}deg` }],
                      },
                    ]}
                  />
                );
              })()
            : null;

          return (
            <View key={`${data[index]?.label}-${index}`}>
              {segment}
              <View style={[styles.chartDotGlow, { left: point.x - 10, top: point.y - 10 }]} />
              <View style={[styles.chartDot, { left: point.x - 5, top: point.y - 5 }]} />
            </View>
          );
        })}
        <Text style={styles.chartStartLabel}>{data[0]?.label}</Text>
        <Text style={styles.chartEndLabel}>{data.at(-1)?.label}</Text>
      </View>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { weightUnit } = useUserPreferences();
  const topInset = useScreenTopInset("stack");
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [metric, setMetric] = useState<MetricKey>("weight");
  const [activeMediaId, setActiveMediaId] = useState<string | undefined>();

  const { data, isLoading, isError } = trpc.exercise.detailPage.useQuery(
    { id: id!, chartLimit: 12 },
    { enabled: !!id, staleTime: queryStaleTime.exerciseDetail },
  );

  const exercise = data?.exercise;
  const chart = data?.chart ?? [];
  const prs = data?.personalRecords ?? [];
  const media = useMemo(() => (exercise ? buildMediaList(exercise) : []), [exercise]);
  const preferredMedia = useMemo(
    () => media.find((item) => item.type === "VIDEO") ?? media.find((item) => item.type === "IMAGE"),
    [media],
  );
  const activeMedia = media.find((item) => item.id === activeMediaId) ?? preferredMedia;

  useEffect(() => {
    setActiveMediaId(preferredMedia?.id);
  }, [preferredMedia?.id]);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (isError || !exercise) {
    return (
      <Screen>
        <View style={styles.errorHeader}>
          <Pressable onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Exercise</Text>
          <View style={styles.headerIcon} />
        </View>
        <EmptyState icon="alert-circle-outline" title="Exercise not found" message="It may have been removed." />
      </Screen>
    );
  }

  const primary = exercise.muscles.find((m) => m.isPrimary)?.muscle.name ?? "-";
  const secondary = exercise.muscles.filter((m) => !m.isPrimary).map((m) => m.muscle.name);
  const equipment = exercise.equipment.map((item) => item.equipment.name);
  const instructions = exercise.instructions ? stripHtml(exercise.instructions) : null;
  const unitLabel = metricUnit(metric, weightUnit);
  const chartValues = chart.map((point) => metricValue(point, metric, weightUnit));
  const hasChartData = chartValues.some((value) => value > 0);
  const latestPoint = chart.at(-1);
  const latestKgValue = hasChartData && latestPoint
    ? (metric === "weight" ? latestPoint.maxWeight : metric === "oneRm" ? latestPoint.maxOneRm : latestPoint.volume)
    : 0;
  const latestPr = prs.find((pr) => {
    if (metric === "weight") return pr.type === "MAX_WEIGHT";
    if (metric === "oneRm") return pr.type === "ESTIMATED_1RM";
    return pr.type === "MAX_VOLUME";
  });
  const displayKg = hasChartData ? latestKgValue : (latestPr?.value ?? 0);
  const headlineText = displayKg > 0
    ? metric === "volume"
      ? `${Math.round(tonnageFromKg(displayKg, weightUnit)).toLocaleString()} ${unitLabel}`
      : `${formatWeight(displayKg, weightUnit)} ${unitLabel}`
    : `— ${unitLabel}`;
  const headlineMeta = hasChartData
    ? (latestPoint?.label ?? "Latest")
    : latestPr
      ? "Personal best"
      : "No data yet";

  const prRows = PR_DISPLAY_ORDER.map((type) => {
    const record = prs.find((pr) => pr.type === type);
    return { type, value: record?.value ?? null };
  }).filter((row) => row.type === "MAX_WEIGHT" || row.type === "ESTIMATED_1RM" || row.type === "MAX_VOLUME" || row.value != null);

  const handleShare = () => {
    void Share.share({ message: `${exercise.name} on Kak Fit` });
  };

  const renderSummary = () => (
    <>
      <Animated.View entering={FadeInDown.duration(220)} style={styles.summaryBlock}>
        <Text style={styles.exerciseTitle}>{exercise.name}</Text>
        <Text style={styles.metaLine}>Primary: {primary}</Text>
        {secondary.length > 0 ? <Text style={styles.metaLine}>Secondary: {secondary.join(", ")}</Text> : null}
        {equipment.length > 0 ? <Text style={styles.metaLine}>Equipment: {equipment.join(", ")}</Text> : null}
      </Animated.View>

      <InfoShortcut
        icon="bulb-outline"
        text={`How to perform ${exercise.name}`}
        onPress={() => setActiveTab("howTo")}
        styles={styles}
        colors={colors}
      />

      {renderHistory()}
      {renderRecords()}
      {instructions ? renderInstructions(true) : null}
    </>
  );

  const renderHistory = () => (
    <Animated.View entering={FadeInDown.duration(240)} style={styles.sectionBlock}>
      <View style={styles.chartHeader}>
        <View style={styles.chartHeaderMain}>
          <Text style={styles.chartTitle}>{headlineText}</Text>
          <Text style={styles.chartMeta}>{headlineMeta}</Text>
        </View>
        <Text style={styles.rangeText}>Last 3 months</Text>
      </View>
      <TrendChart data={chart} metric={metric} unit={weightUnit} colors={colors} styles={styles} />
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricTabs}
      >
        {METRICS.map((item) => {
          const active = item.key === metric;
          return (
            <Pressable key={item.key} onPress={() => setMetric(item.key)} style={[styles.metricTab, active && styles.metricTabActive]}>
              <Text style={[styles.metricTabText, active && styles.metricTabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const renderRecords = () => (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.recordsBlock}>
      <View style={styles.prHeader}>
        <View style={styles.prIconWrap}>
          <Ionicons name="medal" size={22} color={colors.gold} />
        </View>
        <Text style={styles.prTitle}>Personal Records</Text>
      </View>
      {prRows.map((row) => (
        <View key={row.type} style={styles.prRow}>
          <Text style={styles.prName}>{prLabel(row.type)}</Text>
          <Text style={styles.prValue}>
            {row.value != null && row.value > 0 ? formatRecordValue(row.type, row.value, weightUnit) : "—"}
          </Text>
        </View>
      ))}
    </Animated.View>
  );

  const renderInstructions = (compact = false) => (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.instructionsBlock}>
      {!compact ? <Text style={styles.sectionTitle}>How to</Text> : null}
      <Text style={styles.instructions} numberOfLines={compact ? 5 : undefined}>{instructions}</Text>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: topInset }]}>
        <Pressable onPress={() => router.back()} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleShare} style={styles.headerIcon} hitSlop={8}>
            <Ionicons name="share-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable style={styles.headerIcon} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabItem}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <Animated.View entering={FadeIn.duration(220)}>
          <ExerciseMediaHero key={activeMedia?.id ?? "empty"} media={activeMedia} colors={colors} styles={styles} />
          <MediaRail media={media} activeId={activeMedia?.id} onSelect={setActiveMediaId} styles={styles} colors={colors} />
        </Animated.View>

        {activeTab === "summary" ? renderSummary() : null}
        {activeTab === "history" ? renderHistory() : null}
        {activeTab === "howTo" ? renderInstructions(false) : null}
        {activeTab === "records" ? renderRecords() : null}
      </ScrollView>
    </View>
  );
}

function InfoShortcut({ icon, text, onPress, styles, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <Pressable onPress={onPress} style={styles.infoShortcut}>
      <Ionicons name={icon} size={26} color={colors.accent} />
      <Text style={styles.infoShortcutText} numberOfLines={1}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => {
  const isDark = colors.bg === "#000000";
  return StyleSheet.create({
    root: { ...flexFill, backgroundColor: colors.bg, ...webFlexScreen },
    errorHeader: {
      minHeight: 56,
      backgroundColor: colors.bgElevated,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    headerBar: {
      minHeight: 56,
      backgroundColor: colors.bgElevated,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, minWidth: 0, ...typography.body, fontWeight: "600", color: colors.text, textAlign: "center" },
    headerActions: { flexDirection: "row", alignItems: "center" },
    tabs: { minHeight: 48, backgroundColor: colors.bgElevated, flexDirection: "row", alignItems: "flex-end" },
    tabItem: { flex: 1, minHeight: 48, justifyContent: "center" },
    tabText: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" },
    tabTextActive: { color: colors.accent, fontWeight: "700" },
    tabUnderline: { position: "absolute", left: spacing.xs, right: spacing.xs, bottom: 0, height: 2, borderRadius: 2, backgroundColor: colors.accent },
    scroll: { ...flexFill },
    content: { paddingBottom: spacing.xxxl },
    mediaHero: {
      height: 238,
      backgroundColor: isDark ? "#F7F7F7" : colors.bgElevated,
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    mediaImage: { width: "100%", height: "100%" },
    mediaVideo: { width: "100%", height: "100%", backgroundColor: "#000000" },
    mediaEmpty: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
    mediaRail: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
    mediaThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mediaThumbActive: { borderColor: colors.accent, borderWidth: 2 },
    mediaThumbImage: { width: "100%", height: "100%" },
    mediaThumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHover },
    mediaThumbBadge: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    mediaThumbIndex: {
      position: "absolute",
      left: 5,
      bottom: 3,
      ...typography.label,
      color: colors.textMuted,
    },
    mediaThumbIndexActive: { color: colors.accent },
    summaryBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
    exerciseTitle: { ...typography.h1, color: colors.text, lineHeight: 36 },
    metaLine: { color: colors.textMuted, ...typography.body, lineHeight: 21 },
    infoShortcut: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    infoShortcutText: { ...typography.body, color: colors.text, flex: 1 },
    sectionBlock: { paddingTop: spacing.lg },
    chartHeader: {
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    chartHeaderMain: { flex: 1, minWidth: 0, gap: 2 },
    chartTitle: { color: colors.text, ...typography.h2 },
    chartMeta: { ...typography.caption, color: colors.textMuted },
    chartMuted: { color: colors.textMuted, fontWeight: "500" },
    rangeText: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
    chartCanvas: {
      marginHorizontal: spacing.lg,
      minHeight: 188,
      flexDirection: "row",
      borderRadius: radius.lg,
      backgroundColor: isDark ? colors.bg : colors.surface,
      borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      paddingVertical: spacing.sm,
      overflow: "hidden",
    },
    axisLabels: { width: 34, height: 172, justifyContent: "space-between", paddingVertical: 16, alignItems: "flex-end" },
    axisText: { ...typography.label, color: colors.textDim, fontWeight: "500" },
    chartPlot: { position: "relative" },
    gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
    chartSegment: { position: "absolute", height: 3, borderRadius: 3, backgroundColor: colors.accent },
    chartDotGlow: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accentMuted },
    chartDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    chartStartLabel: { position: "absolute", left: 0, bottom: 0, ...typography.label, color: colors.textDim },
    chartEndLabel: { position: "absolute", right: 0, bottom: 0, ...typography.label, color: colors.textDim },
    emptyChart: {
      marginHorizontal: spacing.lg,
      minHeight: 150,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    emptyChartText: { ...typography.bodySmall, color: colors.textMuted },
    metricTabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingRight: spacing.xl, paddingVertical: spacing.md },
    metricTab: {
      minHeight: 42,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    metricTabActive: { backgroundColor: colors.accent },
    metricTabText: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
    metricTabTextActive: { color: colors.onAccent },
    recordsBlock: { paddingTop: spacing.lg },
    prHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
    prIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldMuted },
    prTitle: { flex: 1, ...typography.h3, color: colors.textMuted },
    prRow: {
      minHeight: 58,
      marginHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    prName: { ...typography.body, color: colors.text, flex: 1 },
    prValue: { ...typography.h3, color: colors.text, textAlign: "right" },
    instructionsBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
    sectionTitle: { ...typography.h2, color: colors.text },
    instructions: { ...typography.body, color: colors.textMuted, lineHeight: 23 },
  });
};
