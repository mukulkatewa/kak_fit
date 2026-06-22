import { useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { EmptyState, Screen } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

export default function PhotosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();

  const { data: photos, isLoading } = trpc.progressPhoto.list.useQuery({ limit: 60 });
  const { data: storage } = trpc.progressPhoto.storageEnabled.useQuery();
  const enabled = storage?.enabled ?? false;

  const upload = trpc.progressPhoto.upload.useMutation({
    onSuccess: () => utils.progressPhoto.list.invalidate(),
    onError: (e) => Alert.alert("Upload failed", e.message),
  });

  const remove = trpc.progressPhoto.delete.useMutation({
    onSuccess: () => utils.progressPhoto.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow Kak Fit to access your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    upload.mutate({ base64: asset.base64!, contentType: asset.mimeType ?? "image/jpeg" });
  };

  const confirmDelete = (id: string) =>
    Alert.alert("Delete photo?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id }) },
    ]);

  return (
    <Screen scroll>
      <HevyStackHeader
        title="Progress Photos"
        onBack={() => router.back()}
        right={
          <View style={styles.headerRight}>
            {(photos ?? []).length >= 2 ? (
              <Pressable hitSlop={8} onPress={() => router.push("/photos/compare")} style={styles.iconBtn}>
                <Ionicons name="git-compare-outline" size={20} color={colors.text} />
              </Pressable>
            ) : null}
            {enabled ? (
              <Pressable
                hitSlop={8}
                onPress={addPhoto}
                disabled={upload.isPending}
                style={styles.addBtn}
              >
                {upload.isPending ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <Ionicons name="add" size={20} color={colors.onAccent} />
                )}
              </Pressable>
            ) : null}
          </View>
        }
      />

      {!enabled ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Storage not configured"
          message="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server to enable photo uploads."
        />
      ) : isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (photos ?? []).length === 0 ? (
        <EmptyState
          icon="camera-outline"
          title="No photos yet"
          message="Tap + to add your first progress photo. Long-press any photo to delete it."
        />
      ) : (
        <View style={styles.grid}>
          {photos?.map((p) => (
            <Pressable key={p.id} onLongPress={() => confirmDelete(p.id)} style={styles.card}>
              <Image source={{ uri: p.url }} style={styles.img} />
              <Text style={styles.date}>
                {new Date(p.takenAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "2-digit",
                })}
              </Text>
              {p.note ? <Text style={styles.note} numberOfLines={1}>{p.note}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.hint}>Long-press a photo to delete it.</Text>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    card: { width: "47%", gap: 4 },
    img: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    date: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
    note: { fontSize: 11, color: colors.textDim, textAlign: "center" },
    hint: { fontSize: 12, color: colors.textDim, textAlign: "center", marginTop: spacing.lg },
  });
