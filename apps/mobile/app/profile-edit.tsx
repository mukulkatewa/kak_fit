import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Screen } from "../src/components/ui";
import { HevyModalHeader } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const initialized = useRef(false);
  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      setName(user.name ?? "");
      setBio(user.bio ?? "");
    }
  }, [user]);

  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert("Couldn't save", e.message),
  });

  return (
    <Screen scroll variant="modal" padded={false}>
      <View style={styles.headerPad}>
        <HevyModalHeader
          title="Edit Profile"
          onCancel={() => router.back()}
          onSave={() => save.mutate({ name: name.trim() || "Athlete", bio: bio.trim() || null })}
          saveDisabled={name.trim().length === 0}
          saveLoading={save.isPending}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <Avatar name={name || user?.name} size={88} />
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others about your training…"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.textArea]}
          multiline
          maxLength={280}
        />
        <Text style={styles.counter}>{bio.length}/280</Text>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerPad: { paddingHorizontal: spacing.lg },
    body: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
    avatarWrap: { alignItems: "center", paddingVertical: spacing.md },
    label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginTop: spacing.md },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 16,
    },
    textArea: { minHeight: 100, textAlignVertical: "top" },
    counter: { color: colors.textDim, fontSize: 12, textAlign: "right" },
  });
