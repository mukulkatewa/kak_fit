import { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import type { ViewStyle } from "react-native";
import {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
  type EntryOrExitLayoutType,
} from "react-native-reanimated";

export const SPRING_CONFIG = {
  snappy: { damping: 15, stiffness: 400 },
  gentle: { damping: 20, stiffness: 200 },
  bouncy: { damping: 10, stiffness: 300 },
} as const;

export const TRANSITIONS = {
  layout: LinearTransition.springify().damping(18),
} as const;

/** Pressable scale feedback — attach `scale` to an Animated.View wrapper. */
export function useSpringPress() {
  const scaleValue = useSharedValue(1);

  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const onPressIn = () => {
    scaleValue.value = withSpring(0.95, SPRING_CONFIG.snappy);
  };

  const onPressOut = () => {
    scaleValue.value = withSpring(1, SPRING_CONFIG.snappy);
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

/** Web-safe entrance — FadeInDown can clip content above the viewport on web. */
export function entranceDown(delay = 0): EntryOrExitLayoutType {
  if (Platform.OS === "web") {
    return delay > 0 ? FadeIn.delay(delay).duration(220) : FadeIn.duration(220);
  }
  return delay > 0
    ? FadeInDown.delay(delay).springify().damping(16)
    : FadeInDown.springify().damping(16);
}

/** Staggered list entrance — pass to `entering` on an Animated.View. */
export function useStaggeredEntrance(
  index: number,
  baseDelay = 80,
): EntryOrExitLayoutType {
  return useMemo(
    () => entranceDown(index * baseDelay),
    [index, baseDelay],
  );
}

/** 360° spin on press — attach `rotation` to an Animated.View wrapper. */
export function useRotateOnPress() {
  const rotationValue = useSharedValue(0);

  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationValue.value}deg` }],
  }));

  const onPress = () => {
    rotationValue.value = withSpring(rotationValue.value + 360, SPRING_CONFIG.snappy);
  };

  return { rotation, onPress };
}
