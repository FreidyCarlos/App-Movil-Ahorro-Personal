import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider } from "../mobile/presentation/app-provider.js";
import { useAppColors } from "../mobile/presentation/theme.js";

function AppNavigator() {
  const colors = useAppColors();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar style={useColorScheme() === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: reduceMotion ? "none" : "default",
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 17, fontWeight: "800" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="new-goal" options={{ title: "Diseñar una meta" }} />
        <Stack.Screen name="data" options={{ title: "Cuidar mis datos" }} />
        <Stack.Screen name="goal/[id]" options={{ title: "Detalle de la meta" }} />
        <Stack.Screen name="goal/[id]/register" options={{ title: "Registrar movimiento" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
