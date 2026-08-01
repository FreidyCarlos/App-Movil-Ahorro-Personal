import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider } from "../mobile/presentation/app-provider.js";
import { useAppColors } from "../mobile/presentation/theme.js";

function AppNavigator() {
  const colors = useAppColors();
  return (
    <>
      <StatusBar style={useColorScheme() === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Ahorro Personal" }} />
        <Stack.Screen name="new-goal" options={{ title: "Nueva meta" }} />
        <Stack.Screen name="data" options={{ title: "Copias de seguridad" }} />
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
