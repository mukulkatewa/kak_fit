import "react-native-gesture-handler";
import { Platform, Text, TextInput } from "react-native";

const fontFamily = Platform.select({
  android: "Roboto",
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
});

if (fontFamily) {
  Text.defaultProps = { ...(Text.defaultProps ?? {}), style: { fontFamily } };
  TextInput.defaultProps = { ...(TextInput.defaultProps ?? {}), style: { fontFamily } };
}

import "expo-router/entry";
