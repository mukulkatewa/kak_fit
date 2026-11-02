import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type AnimatedStyle,
  type EntryOrExitLayoutType,
} from "react-native-reanimated";

export const SPRING_CONFIG = {
  gentle: { damping: 24, stiffness: 200, overshootClamping: true },
} as const;

/** Pressable scale feedback — attach `scale` to an Animated.View wrapper. */
export function useSpringPress() {
  const scaleValue = useSharedValue(1);

  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const onPressIn = () => {
    scaleValue.value = withTiming(0.98, { duration: 80 });
  };

  const onPressOut = () => {
    scaleValue.value = withTiming(1, { duration: 100 });
  };

  return { scale, onPressIn, onPressOut };
}

/** Infinite opacity pulse for skeleton / loading placeholders. */
export function usePulse(): AnimatedStyle<ViewStyle> {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.4, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}

/** A short entrance fade keeps content in place while navigating. */
export function entranceDown(delay = 0): EntryOrExitLayoutType {
  return FadeIn.delay(Math.min(delay, 120)).duration(160);
}
