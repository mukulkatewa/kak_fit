import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer, type VideoSource } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../../src/components/charts";
import { EmptyState, Screen } from "../../src/components/ui";
import { flexFill, useScreenTopInset, webFlexScreen } from "../../src/lib/layout-constants";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ExerciseHeroMedia = {
  type: "IMAGE" | "VIDEO";
  storageUrl: string;
  thumbnailUrl?: string | null;
};

function ExerciseMediaHero({ media, colors, styles }: {
  media?: ExerciseHeroMedia;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const videoSource: VideoSource = media?.type === "VIDEO" ? { uri: media.storageUrl, useCaching: true } : null;
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = true;
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
        <Image source={{ uri: media.storageUrl }} style={styles.mediaImage} contentFit="contain" cachePolicy="memory-disk" />
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

export default function ExerciseDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const topInset = useScreenTopInset("stack");
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise, isLoading, isError } = trpc.exercise.getById.useQuery(
    { id: id! },
    { enabled: !!id, staleTime: queryStaleTime.exerciseDetail },
  );
  const { data: chart } = trpc.progress.exerciseChart.useQuery(
    { exerciseId: id!, limit: 10 },
    { enabled: !!id, staleTime: queryStaleTime.progress },
  );
  const { data: prs } = trpc.personalRecord.byExercise.useQuery(
    { exerciseId: id! },
    { enabled: !!id, staleTime: queryStaleTime.progress },
  );

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
        <View style={styles.headerBar}>
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
  const media = exercise.media ?? [];
  const heroMedia = media.find((item) => item.type === "VIDEO") ?? media.find((item) => item.type === "IMAGE");
  const latestMax = chart?.at(-1)?.maxWeight ?? 0;
  const instructions = exercise.instructions ? stripHtml(exercise.instructions) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: topInset }]}>
        <Pressable onPress={() => router.back()} style={styles.headerIcon} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} hitSlop={8}>
            <Ionicons name="share-outline" size={25} color={colors.text} />
          </Pressable>
          <Pressable style={styles.headerIcon} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabs}>
        {['Summary', 'History', 'How to', 'Leaderboard'].map((tab, index) => (
          <View key={tab} style={styles.tabItem}>
            <Text style={[styles.tabText, index === 0 && styles.tabTextActive]}>{tab}</Text>
            {index === 0 ? <View style={styles.tabUnderline} /> : null}
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <ExerciseMediaHero media={heroMedia} colors={colors} styles={styles} />

        <View style={styles.summaryBlock}>
          <Text style={styles.metaLine}>Primary: {primary}</Text>
          {secondary.length > 0 ? <Text style={styles.metaLine}>Secondary: {secondary.join(", ")}</Text> : null}
          {exercise.equipment.length > 0 ? (
            <Text style={styles.metaLine}>Equipment: {exercise.equipment.map((item) => item.equipment.name).join(", ")}</Text>
          ) : null}
        </View>

        <View style={styles.howToRow}>
          <Ionicons name="bulb-outline" size={30} color={colors.accent} />
          <Text style={styles.howToText}>How to log {exercise.category?.name?.toLowerCase() ?? "this exercise"} exercises</Text>
        </View>

        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{Math.round(latestMax)} kg <Text style={styles.chartMuted}>(In progress)</Text></Text>
          <Text style={styles.rangeText}>Last 3 months</Text>
        </View>
        <BarChart
          data={(chart ?? []).map((point) => ({ label: point.label, value: point.maxWeight }))}
          color={colors.accent}
          unit=" kg"
        />

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricTabs}
        >
          {['Heaviest Weight', 'One Rep Max', 'Best Set Volume'].map((label, index) => (
            <View key={label} style={[styles.metricTab, index === 0 && styles.metricTabActive]}>
              <Text style={[styles.metricTabText, index === 0 && styles.metricTabTextActive]}>{label}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.prHeader}>
          <Ionicons name="medal" size={30} color={colors.gold} />
          <Text style={styles.prTitle}>Personal Records</Text>
          <View style={styles.helpDot}><Text style={styles.helpText}>?</Text></View>
        </View>
        {(prs ?? []).length === 0 ? (
          <View style={styles.prRow}>
            <Text style={styles.prName}>Heaviest Weight</Text>
            <Text style={styles.prValue}>-</Text>
          </View>
        ) : (
          prs?.map((pr) => (
            <View key={pr.id} style={styles.prRow}>
              <Text style={styles.prName}>{pr.type.replace(/_/g, " ")}</Text>
              <Text style={styles.prValue}>{pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}</Text>
            </View>
          ))
        )}

        {instructions ? (
          <View style={styles.instructionsBlock}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <Text style={styles.instructions}>{instructions}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { ...flexFill, backgroundColor: colors.bg, ...webFlexScreen },
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
  headerTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 18, fontWeight: "600", textAlign: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  tabs: { minHeight: 48, backgroundColor: colors.bgElevated, flexDirection: "row", alignItems: "flex-end" },
  tabItem: { flex: 1, minHeight: 48, justifyContent: "center" },
  tabText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  tabTextActive: { color: colors.accent, fontWeight: "600" },
  tabUnderline: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.accent },
  scroll: { ...flexFill },
  content: { paddingBottom: spacing.xxxl },
  mediaHero: { height: 220, backgroundColor: colors.bgElevated, alignItems: "center", justifyContent: "center" },
  mediaImage: { width: "100%", height: "100%" },
  mediaVideo: { width: "100%", height: "100%" },
  mediaEmpty: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  summaryBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
  metaLine: { color: colors.textMuted, ...typography.body, lineHeight: 20 },
  howToRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  howToText: { color: colors.text, fontSize: 15, flex: 1 },
  chartHeader: { paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  chartTitle: { color: colors.text, ...typography.h2 },
  chartMuted: { color: colors.textMuted, fontWeight: "400" },
  rangeText: { color: colors.accent, fontSize: 14, fontWeight: "500" },
  metricTabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  metricTab: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.surfaceHover, alignItems: "center", justifyContent: "center" },
  metricTabActive: { backgroundColor: colors.accent },
  metricTabText: { color: colors.text, fontSize: 14, fontWeight: "500" },
  metricTabTextActive: { color: colors.onAccent },
  prHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  prTitle: { flex: 1, color: colors.textMuted, fontSize: 17, fontWeight: "600" },
  helpDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHover, alignItems: "center", justifyContent: "center" },
  helpText: { color: colors.textMuted, fontWeight: "800" },
  prRow: { minHeight: 64, marginHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prName: { color: colors.text, fontSize: 19 },
  prValue: { color: colors.text, fontSize: 20 },
  instructionsBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: "700" },
  instructions: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
});
