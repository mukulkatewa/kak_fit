import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
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
  const { data: chart, isLoading } = trpc.bodyMeasurement.chart.useQuery({ field, limit: 12 });
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
      setWeight(""); setBodyFat(""); setWaist(""); setChest(""); setArms("");
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
                    month: "short", day: "numeric", year: "numeric",
                  })}
                  subtitle={parts.join(" · ") || "—"}
                  last={i === (history?.length ?? 0) - 1}
                />
              );
            })}
          </ListGroup>
        </>
      ) : null}

      <Pressable style={styles.photoLink} onPress={() => router.push("/photos")}>
        <Ionicons name="camera-outline" size={18} color={colors.accent} />
        <Text style={styles.photoLinkText}>View Progress Photos →</Text>
      </Pressable>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  latest: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, gap: 4 },
  latestLabel: { fontSize: 13, color: colors.textMuted },
  latestVal: { fontSize: 22, fontWeight: "700", color: colors.text },
  latestDate: { fontSize: 13, color: colors.textDim },
  form: { gap: spacing.md },
  photoLink: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    justifyContent: "center", paddingVertical: spacing.lg,
  },
  photoLinkText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
});
