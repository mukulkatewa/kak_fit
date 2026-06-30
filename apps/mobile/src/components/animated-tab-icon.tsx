import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type TabIconComponent = React.FC<{ color?: string; size?: number }>;

type AnimatedTabIconProps = {
  focused: boolean;
  color: string;
  size: number;
  accentColor: string;
  IconOutline: TabIconComponent;
  IconSolid: TabIconComponent;
};

export function AnimatedTabIcon({
  focused,
  color,
  size,
  accentColor,
  IconOutline,
  IconSolid,
}: AnimatedTabIconProps) {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 15 }),
      );
      dotOpacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withSpring(1, { damping: 15 });
      dotOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [focused, scale, dotOpacity]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  const Icon = focused ? IconSolid : IconOutline;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={iconStyle}>
        <Icon color={color} size={size} />
      </Animated.View>
      <Animated.View
        style={[
          {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: accentColor,
            marginTop: 4,
          },
          dotStyle,
        ]}
      />
    </View>
  );
}
