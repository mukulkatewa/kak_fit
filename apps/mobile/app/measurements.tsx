import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../src/components/charts";
import { Button, Header, Input, Screen, SectionHeader } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { colors, spacing } from "../src/lib/theme";

export default function MeasurementsScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: latest } = trpc.bodyMeasurement.latest.useQuery();
  const { data: weightChart, isLoading } = trpc.bodyMeasurement.chart.useQuery({
    field: "weight",
    limit: 12,
  });

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

      <SectionHeader title="Weight Trend" />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <BarChart
          data={(weightChart ?? []).map((p) => ({ label: p.label, value: p.value }))}
          color={colors.success}
          unit=" kg"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
