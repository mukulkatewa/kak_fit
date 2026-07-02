import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { HevyStackHeader } from "../../src/components/hevy-ui";
import { Button, EmptyState, Screen } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function PhotoCompareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const { data: photos, isLoading } = trpc.progressPhoto.list.useQuery({ limit: 60 });

  const left = photos?.find((p) => p.id === leftId);
  const right = photos?.find((p) => p.id === rightId);

  const sorted = useMemo(
    () => [...(photos ?? [])].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()),
    [photos],
  );

  const pick = (id: string) => {
    if (!leftId || leftId === id) {
      setLeftId(id);
      if (rightId === id) setRightId(null);
      return;
    }
    if (!rightId || rightId === id) {
      setRightId(id);
      return;
    }
    setRightId(id);
  };

  return (
    <Screen scroll>
      <HevyStackHeader title="Compare Photos" onBack={() => router.back()} />

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (photos ?? []).length < 2 ? (
        <EmptyState
          icon="images-outline"
          title="Need at least 2 photos"
          message="Add more progress photos first, then compare side by side."
        />
      ) : (
        <>
          <View style={styles.compareRow}>
            <ComparePane photo={left} label="Before" placeholder="Tap a photo below" />
            <ComparePane photo={right} label="After" placeholder="Tap another photo" />
          </View>

          {left && right ? (
            <Text style={styles.delta}>
              {formatDelta(new Date(left.takenAt), new Date(right.takenAt))}
            </Text>
          ) : null}

          <Text style={styles.hint}>Tap to select before (left) then after (right).</Text>

          <View style={styles.thumbGrid}>
            {sorted.map((p) => {
              const slot = p.id === leftId ? "left" : p.id === rightId ? "right" : null;
              return (
                <Pressable key={p.id} onPress={() => pick(p.id)} style={[styles.thumb, slot && styles.thumbActive]}>
                  <Image
                    source={{ uri: p.url }}
                    style={styles.thumbImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                    recyclingKey={p.id}
                  />
                  <Text style={styles.thumbDate}>
                    {new Date(p.takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </Text>
                  {slot ? <Text style={styles.thumbBadge}>{slot === "left" ? "Before" : "After"}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Clear selection"
            variant="ghost"
            fullWidth
            onPress={() => {
              setLeftId(null);
              setRightId(null);
            }}
          />
        </>
      )}
    </Screen>
  );
}

function ComparePane({
  photo,
  label,
  placeholder,
}: {
  photo?: { url: string; takenAt: string | Date };
  label: string;
  placeholder: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pane}>
      <Text style={styles.paneLabel}>{label}</Text>
      {photo ? (
        <>
          <Image
            source={{ uri: photo.url }}
            style={styles.paneImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={photo.url}
          />
          <Text style={styles.paneDate}>
            {new Date(photo.takenAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </>
      ) : (
        <View style={styles.paneEmpty}>
          <Text style={styles.paneEmptyText}>{placeholder}</Text>
        </View>
      )}
    </View>
  );
}

function formatDelta(a: Date, b: Date) {
  const days = Math.abs(Math.round((b.getTime() - a.getTime()) / 86_400_000));
  if (days === 0) return "Same day";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} apart`;
  const months = Math.round(days / 30);
  return `~${months} month${months === 1 ? "" : "s"} apart`;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    compareRow: { flexDirection: "row", gap: spacing.sm },
    pane: { flex: 1, gap: spacing.xs },
    paneLabel: { ...typography.caption, fontWeight: "700", color: colors.textMuted, textAlign: "center" },
    paneImg: { width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: colors.surface },
    paneDate: { ...typography.label, color: colors.textDim, textAlign: "center" },
    paneEmpty: {
      aspectRatio: 3 / 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.sm,
    },
    paneEmptyText: { ...typography.label, color: colors.textDim, textAlign: "center" },
    delta: { ...typography.bodySmall, fontWeight: "700", color: colors.accent, textAlign: "center", marginTop: spacing.sm },
    hint: { ...typography.label, color: colors.textDim, textAlign: "center", marginVertical: spacing.md },
    thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    thumb: { width: "30%", gap: 2, borderRadius: radius.md, padding: 2 },
    thumbActive: { borderWidth: 2, borderColor: colors.accent },
    thumbImg: { width: "100%", aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.surface },
    thumbDate: { ...typography.label, fontSize: 10, color: colors.textDim, textAlign: "center" }, // compact thumbnail label
    thumbBadge: { ...typography.label, fontSize: 10, fontWeight: "700", color: colors.accent, textAlign: "center" },
  });
