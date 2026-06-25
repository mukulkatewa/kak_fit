import { Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

const AVATAR_COLORS = [
  "#FF6B6B",
  "#FFB347",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash * 31) + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

export function ExerciseAvatar({ name, imageUrl, size = 40 }: Props) {
  const { colors } = useTheme();
  const radius = size / 2;
  const fontSize = Math.round(size * 0.35);
  const borderRadius = radius;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden" as const,
  };

  if (imageUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  const bg = hashColor(name);
  return (
    <View style={[containerStyle, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: "#fff", fontSize, fontWeight: "700", lineHeight: size * 0.9 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
