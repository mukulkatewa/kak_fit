import { useMemo } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

export type VesselKind = "glass" | "mug" | "bowl" | "apple" | "chapati" | "egg";

type VesselDef = {
  body: string;
  top: number;
  bottom: number;
  renderBack?: (lineColor: string) => React.ReactNode;
  renderFront?: (lineColor: string) => React.ReactNode;
};

const VESSELS: Record<VesselKind, VesselDef> = {
  glass: {
    body: "M22,16 A42,7 0 0 0 106,16 L97,138 Q64,148 31,138 Z",
    top: 16,
    bottom: 138,
    renderFront: (lineColor) => (
      <>
        <Ellipse cx="64" cy="16" rx="42" ry="7" fill="none" stroke={lineColor} strokeWidth={2.4} strokeOpacity={0.85} />
        <Ellipse cx="64" cy="16" rx="42" ry="7" fill="#fff" fillOpacity={0.16} />
      </>
    ),
  },
  mug: {
    body: "M32,30 A32,7 0 0 0 96,30 L92,130 Q64,144 36,130 Z",
    top: 30,
    bottom: 130,
    renderBack: (lineColor) => (
      <Path d="M95,52 C120,52 120,96 95,96" fill="none" stroke={lineColor} strokeWidth={7} strokeOpacity={0.9} />
    ),
    renderFront: (lineColor) => (
      <>
        <Ellipse cx="64" cy="30" rx="32" ry="7" fill="none" stroke={lineColor} strokeWidth={2.4} strokeOpacity={0.9} />
        <Ellipse cx="64" cy="30" rx="32" ry="7" fill="#fff" fillOpacity={0.16} />
      </>
    ),
  },
  bowl: {
    body: "M24,66 A56,50 0 0 0 104,66 Z",
    top: 66,
    bottom: 112,
    renderBack: () => <Ellipse cx="64" cy="66" rx="40" ry="7" fill="#fff" fillOpacity={0.3} />,
    renderFront: (lineColor) => (
      <>
        <Path d="M24,66 A56,50 0 0 0 104,66" fill="none" stroke={lineColor} strokeWidth={2.6} strokeOpacity={0.9} />
        <Ellipse cx="64" cy="66" rx="40" ry="7" fill="none" stroke={lineColor} strokeWidth={2} strokeOpacity={0.7} />
      </>
    ),
  },
  apple: {
    body: "M64,50 C54,36 34,38 30,60 C26,84 36,124 52,140 C59,147 69,147 76,140 C92,124 102,84 98,60 C94,38 74,36 64,50 Z",
    top: 44,
    bottom: 146,
    renderBack: () => (
      <>
        <Path d="M64,48 C66,36 70,30 74,24" fill="none" stroke="#7a4a2a" strokeWidth={4} strokeLinecap="round" />
        <Path d="M74,28 C86,20 98,24 95,36 C85,42 75,38 74,28 Z" fill="#57a659" />
      </>
    ),
    renderFront: () => (
      <Path d="M42,62 C38,76 40,98 48,114" fill="none" stroke="#fff" strokeWidth={4} strokeOpacity={0.32} strokeLinecap="round" />
    ),
  },
  chapati: {
    body: "M64,40 C88,40 106,56 106,80 C106,104 88,120 64,120 C40,120 22,104 22,80 C22,56 40,40 64,40 Z",
    top: 40,
    bottom: 120,
    renderFront: () => (
      <>
        <Circle cx="48" cy="66" r="3" fill="#9a6528" opacity={0.5} />
        <Circle cx="80" cy="60" r="2.4" fill="#9a6528" opacity={0.45} />
        <Circle cx="82" cy="92" r="3.2" fill="#9a6528" opacity={0.5} />
        <Circle cx="52" cy="98" r="2.2" fill="#9a6528" opacity={0.4} />
      </>
    ),
  },
  egg: {
    body: "M64,28 C84,28 98,58 98,90 C98,118 83,138 64,138 C45,138 30,118 30,90 C30,58 44,28 64,28 Z",
    top: 28,
    bottom: 138,
    renderFront: () => <Ellipse cx="52" cy="60" rx="9" ry="14" fill="#fff" opacity={0.38} transform="rotate(-18 52 60)" />,
  },
};

export type VesselIconProps = {
  vessel: VesselKind;
  amount: number;
  fillMax: number;
  lineColor: string;
  fillTop: string;
  fillBottom: string;
  width?: number;
  height?: number;
  style?: ViewStyle;
};

export function VesselIcon({
  vessel,
  amount,
  fillMax,
  lineColor,
  fillTop,
  fillBottom,
  width = 38,
  height = 44,
  style,
}: VesselIconProps) {
  const clipId = useMemo(() => `vessel-${vessel}-${Math.random().toString(36).slice(2, 8)}`, [vessel]);
  const gradId = `${clipId}-grad`;
  const def = VESSELS[vessel];
  const frac = Math.max(0, Math.min(1, amount / fillMax));
  const fillY = def.bottom - frac * (def.bottom - def.top);

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height} viewBox="0 0 128 160">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={def.body} />
          </ClipPath>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={fillBottom} />
            <Stop offset="50%" stopColor={fillTop} />
            <Stop offset="100%" stopColor={fillBottom} />
          </LinearGradient>
        </Defs>
        {def.renderBack?.(lineColor)}
        <Path d={def.body} fill="#fff" fillOpacity={0.34} />
        <G clipPath={`url(#${clipId})`}>
          <Rect x={0} y={fillY} width={128} height={160} fill={`url(#${gradId})`} />
        </G>
        <Path d={def.body} fill="none" stroke={lineColor} strokeWidth={2.4} strokeOpacity={0.85} />
        {def.renderFront?.(lineColor)}
      </Svg>
    </View>
  );
}
