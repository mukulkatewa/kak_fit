import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { BarChart } from "../src/components/charts";
import { Button, Header, Input, ListGroup, ListRow, Screen, SectionHeader } from "../src/components/ui";
import { HevySegmentedControl } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type Field = "weight" | "bodyFat" | "waist" | "chest" | "arms";
const FIELDS: Array<{ key: Field; label: string; unit: string }> = [
  { key: "weight", label: "Weight", unit: " kg" },
  { key: "bodyFat", label: "Fat", unit: "%" },
  { key: "waist", label: "Waist", unit: " cm" },
  { key: "chest", label: "Chest", unit: " cm" },
  { key: "arms", label: "Arms", unit: " cm" },
];

export default function MeasurementsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [field, setField] = useState<Field>("weight");
  const { data: latest } = trpc.bodyMeasurement.latest.useQuery();
  const { data: history } = trpc.bodyMeasurement.list.useQuery({ limit: 20 });
  const { data: photos } = trpc.progressPhoto.list.useQuery({ limit: 30 });
  const { data: storage } = trpc.progressPhoto.storageEnabled.useQuery();
  const photosEnabled = storage?.enabled ?? false;

  const uploadPhoto = trpc.progressPhoto.upload.useMutation({
    onSuccess: () => utils.progressPhoto.list.invalidate(),
    onError: (e) => Alert.alert("Upload failed", e.message),
  });
  const deletePhoto = trpc.progressPhoto.delete.useMutation({
    onSuccess: () => utils.progressPhoto.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to add progress photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    uploadPhoto.mutate({
      base64: asset.base64!,
      contentType: asset.mimeType ?? "image/jpeg",
    });
  };

  const confirmDeletePhoto = (id: string) =>
    Alert.alert("Delete photo?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePhoto.mutate({ id }) },
    ]);
  const { data: chart, isLoading } = trpc.bodyMeasurement.chart.useQuery({
    field,
    limit: 12,
  });
  const activeField = FIELDS.find((f) => f.key === field)!;

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [arms, setArms] = useState("");

  const create = trpc.bodyMeasurement.create.useMutation({
    onSuccess: () => {
      utils.bodyMeasurement.latest.invalidate();
      utils.bodyMeasurement.chart.invalidate();
      utils.bodyMeasurement.list.invalidate();
      setWeight("");
      setBodyFat("");
      setWaist("");
      setChest("");
      setArms("");
      Alert.alert("Saved", "Measurement logged.");
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const save = () => {
    const payload = {
      weight: weight ? Number(weight) : undefined,
      bodyFat: bodyFat ? Number(bodyFat) : undefined,
      waist: waist ? Number(waist) : undefined,
      chest: chest ? Number(chest) : undefined,
      arms: arms ? Number(arms) : undefined,
    };
    if (!Object.values(payload).some((v) => v !== undefined)) {
      Alert.alert("Missing data", "Enter at least one measurement.");
      return;
    }
    create.mutate(payload);
  };

  return (
    <Screen scroll>
      <Header
        title="Body"
        subtitle="Track weight and measurements"
        action={<Button label="Back" variant="ghost" size="sm" onPress={() => router.back()} />}
      />

      {latest ? (
        <View style={styles.latest}>
          <Text style={styles.latestLabel}>Latest</Text>
          <Text style={styles.latestVal}>
            {latest.weight ? `${latest.weight} kg` : "—"}
            {latest.bodyFat ? ` · ${latest.bodyFat}% fat` : ""}
          </Text>
          <Text style={styles.latestDate}>{new Date(latest.date).toLocaleDateString()}</Text>
        </View>
      ) : null}

      <SectionHeader title="Trend" />
      <HevySegmentedControl
        options={FIELDS.map((f) => ({ key: f.key, label: f.label }))}
        value={field}
        onChange={setField}
      />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <BarChart
          data={(chart ?? []).map((p) => ({ label: p.label, value: p.value }))}
          color={colors.accent}
          unit={activeField.unit}
        />
      )}

      <SectionHeader title="Log Measurement" />
      <View style={styles.form}>
        <Input placeholder="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Input placeholder="Body fat %" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" />
        <Input placeholder="Waist (cm)" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" />
        <Input placeholder="Chest (cm)" value={chest} onChangeText={setChest} keyboardType="decimal-pad" />
        <Input placeholder="Arms (cm)" value={arms} onChangeText={setArms} keyboardType="decimal-pad" />
        <Button label="Save" fullWidth onPress={save} loading={create.isPending} />
      </View>

      {(history ?? []).length > 0 ? (
        <>
          <SectionHeader title="History" />
          <ListGroup>
            {history?.map((m, i) => {
              const parts = [
                m.weight != null ? `${m.weight} kg` : null,
                m.bodyFat != null ? `${m.bodyFat}% fat` : null,
                m.waist != null ? `${m.waist} waist` : null,
                m.chest != null ? `${m.chest} chest` : null,
                m.arms != null ? `${m.arms} arms` : null,
              ].filter(Boolean);
              return (
                <ListRow
                  key={m.id}
                  title={new Date(m.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  subtitle={parts.join(" · ") || "—"}
                  last={i === (history?.length ?? 0) - 1}
                />
              );
            })}
          </ListGroup>
        </>
      ) : null}

      <View style={styles.photosHeader}>
        <SectionHeader title="Progress Photos" />
        {photosEnabled ? (
          <Pressable style={styles.photoAddBtn} onPress={addPhoto} disabled={uploadPhoto.isPending}>
            {uploadPhoto.isPending ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={16} color={colors.onAccent} />
                <Text style={styles.photoAddText}>Add</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
      {!photosEnabled ? (
        <Text style={styles.photoEmpty}>Photo storage isn&apos;t configured on the server yet.</Text>
      ) : (photos ?? []).length === 0 ? (
        <Text style={styles.photoEmpty}>Add photos to track visual progress over time.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos?.map((p) => (
            <Pressable key={p.id} onLongPress={() => confirmDeletePhoto(p.id)} style={styles.photoCard}>
              <Image source={{ uri: p.url }} style={styles.photo} />
              <Text style={styles.photoDate}>
                {new Date(p.takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {(photos ?? []).length > 0 ? <Text style={styles.photoHint}>Long-press a photo to delete.</Text> : null}
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  latest: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: 4,
  },
  latestLabel: { fontSize: 13, color: colors.textMuted },
  latestVal: { fontSize: 22, fontWeight: "700", color: colors.text },
  latestDate: { fontSize: 13, color: colors.textDim },
  form: { gap: spacing.md },
  photosHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 64,
    justifyContent: "center",
  },
  photoAddText: { color: colors.onAccent, fontWeight: "700", fontSize: 14 },
  photoEmpty: { color: colors.textMuted, fontSize: 14 },
  photoHint: { color: colors.textDim, fontSize: 12 },
  photoRow: { gap: spacing.md, paddingVertical: spacing.xs },
  photoCard: { gap: 4 },
  photo: { width: 120, height: 160, borderRadius: radius.lg, backgroundColor: colors.surface },
  photoDate: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
});
