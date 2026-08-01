import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MOBILE_ROUTES } from "../application/mobile-navigation.js";
import { useApp } from "../mobile/presentation/app-provider.js";
import { formatCop } from "../mobile/presentation/format.js";
import { useAppColors } from "../mobile/presentation/theme.js";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { ready, busy, error, goals, refresh, clearError } = useApp();

  useFocusEffect(
    useCallback(() => {
      if (ready) {
        void refresh().catch(() => undefined);
      }
    }, [ready, refresh]),
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Tus metas</Text>
      <Text style={[styles.intro, { color: colors.muted }]}>
        La proyección simple suma tus aportes. Sin una tasa configurada no
        muestra rendimientos.
      </Text>

      {busy && !ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.muted }}>Preparando datos locales…</Text>
        </View>
      ) : null}

      {error !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje de error"
          onPress={clearError}
          style={[styles.message, { borderColor: colors.danger }]}
        >
          <Text style={{ color: colors.danger }}>{error}</Text>
        </Pressable>
      ) : null}

      {ready && goals.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Aún no tienes metas
          </Text>
          <Text style={{ color: colors.muted }}>
            Crea una proyección sencilla con un monto y una duración.
          </Text>
        </View>
      ) : null}

      {goals.map((goal) => (
        <View
          key={goal.id}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {goal.name}
          </Text>
          <Text style={[styles.total, { color: colors.primary }]}>
            {formatCop(goal.projectedTotal)}
          </Text>
          <Text style={{ color: colors.muted }}>
            {formatCop(goal.periodicAmount)}{" "}
            {goal.periodicity === "MONTHLY" ? "al mes" : "al año"} durante{" "}
            {goal.numberOfPeriods}{" "}
            {goal.periodicity === "MONTHLY" ? "meses" : "años"}
          </Text>
          <Text style={[styles.noYield, { color: colors.muted }]}>
            Rendimiento proyectado: {formatCop(goal.projectedYield)}
          </Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        disabled={!ready || busy}
        onPress={() => router.push(MOBILE_ROUTES.createGoal)}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: colors.primary,
            opacity: !ready || busy || pressed ? 0.65 : 1,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryText }]}>
          Crear meta simple
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={!ready || busy}
        onPress={() => router.push(MOBILE_ROUTES.data)}
        style={({ pressed }) => [
          styles.secondaryButton,
          {
            borderColor: colors.primary,
            opacity: !ready || busy || pressed ? 0.65 : 1,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          Exportar o importar datos
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: "700" },
  intro: { fontSize: 16, lineHeight: 23 },
  centered: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  message: { borderWidth: 1, borderRadius: 12, padding: 14 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  total: { fontSize: 26, fontWeight: "800" },
  noYield: { marginTop: 4, fontSize: 13 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
});
