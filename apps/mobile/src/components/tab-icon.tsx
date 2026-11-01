import type { FC } from "react";
import { View } from "react-native";

type IconComponent = FC<{ color?: string; size?: number }>;

export function TabIcon({ focused, color, size, IconOutline, IconSolid }: {
  focused: boolean;
  color: string;
  size: number;
  IconOutline: IconComponent;
  IconSolid: IconComponent;
}) {
  const Icon = focused ? IconSolid : IconOutline;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Icon color={color} size={size} />
    </View>
  );
}
