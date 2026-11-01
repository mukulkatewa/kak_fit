import { useEffect, useMemo } from "react";
import type { ViewStyle } from "react-native";
import {
  FadeIn,
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
  snappy: { damping: 24, stiffness: 400, overshootClamping: true },
  gentle: { damping: 24, stiffness: 200, overshootClamping: true },
  bouncy: { damping: 24, stiffness: 300, overshootClamping: true },
} as const;

export const TRANSITIONS = {
  layout: LinearTransition.duration(180),
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
