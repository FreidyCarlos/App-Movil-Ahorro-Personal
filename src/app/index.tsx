import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MOBILE_ROUTES } from "../application/mobile-navigation.js";
import { useApp } from "../mobile/presentation/app-provider.js";
import { formatCop } from "../mobile/presentation/format.js";
import { useAppColors } from "../mobile/presentation/theme.js";
import {
  AppButton,
  AppCard,
  PageIntro,
  SectionHeading,
  StatusMessage,
  Tag,
} from "../mobile/presentation/ui.js";
import {
  APP_SPACING,
  MAX_CONTENT_WIDTH,
} from "../mobile/presentation/visual-system.js";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { ready, busy, error, goals, refresh, clearError } = useApp();
  const projectedTotal = useMemo(
    () =>
      goals
        .reduce((total, goal) => total + BigInt(goal.projectedContributions), 0n)
        .toString(),
    [goals],
  );

  useFocusEffect(
    useCallback(() => {
      if (ready) {
        void refresh().catch(() => undefined);
      }
    }, [ready, refresh]),
  );

  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.scrollContent}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.container}>
        <PageIntro
          description="Organiza cada propósito por separado y mira cuánto planeas aportar, sin promesas ni rendimientos inventados."
          eyebrow="Bitácora personal"
          title="Tu dinero necesita una ruta, no presión."
        />

        {busy && !ready ? (
          <View accessibilityLiveRegion="polite" style={styles.centered}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.loadingText, { color: colors.muted }]}>Preparando tu espacio local…</Text>
          </View>
        ) : null}

        {error === undefined ? null : (
          <StatusMessage tone="danger" onDismiss={clearError}>{error}</StatusMessage>
        )}

        {ready ? (
          <AppCard
            accessibilityLabel={
              goals.length === 0
                ? "Resumen: todavía no hay metas"
                : `Resumen: ${goals.length} metas y ${formatCop(projectedTotal)} en aportes planeados`
            }
            accessible
            style={styles.hero}
            tone="primary"
          >
            <View style={styles.heroTop}>
              <Tag>{goals.length === 0 ? "LISTO PARA EMPEZAR" : "PANORAMA LOCAL"}</Tag>
              <RouteMotif />
            </View>
            <Text style={[styles.heroLabel, { color: colors.muted }]}>Aportes planeados</Text>
            <Text style={[styles.heroTotal, { color: colors.text }]}>
              {formatCop(projectedTotal)}
            </Text>
            <View style={[styles.heroRule, { backgroundColor: colors.primary }]} />
            <Text style={[styles.heroFootnote, { color: colors.muted }]}>
              {goals.length === 0
                ? "Una meta simple solo necesita nombre, monto y duración."
                : `${goals.length} ${goals.length === 1 ? "ruta guardada" : "rutas guardadas"} · planes separados del ahorro real`}
            </Text>
          </AppCard>
        ) : null}

        {ready && goals.length === 0 ? (
          <AppCard style={styles.empty} tone="accent">
            <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.text }]}>Traza tu primer destino</Text>
            <Text style={[styles.body, { color: colors.muted }]}>Dile un nombre, define una cadencia y deja que la app ordene el recorrido.</Text>
            <AppButton
              accessibilityHint="Abre el formulario de una meta simple"
              label="Crear mi primera meta"
              onPress={() => router.push(MOBILE_ROUTES.createGoal)}
            />
          </AppCard>
        ) : null}

        {goals.length > 0 ? (
          <View style={styles.goalsSection}>
            <SectionHeading
              description="Cada tarjeta resume un plan; no representa dinero ya ahorrado."
              title="Tus rutas activas"
            />
            {goals.map((goal, index) => (
              <View key={goal.id} style={styles.goalContainer}>
                <AppCard
                  accessibilityLabel={`${goal.name}. ${goal.projectionBlocked ? "Proyección bloqueada" : `Total planeado ${formatCop(goal.projectedTotal)}`}. Estado ${goal.status}.`}
                  accessible
                  style={styles.goalCard}
                >
                  <View style={styles.goalTopline}>
                    <Text style={[styles.goalIndex, { color: colors.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
                    <View style={styles.cardTags}>
                      <Tag>{goal.projectionMode === "ADVANCED" ? "AVANZADA" : "SIMPLE"}</Tag>
                      <Tag accent>{goal.periodicity === "MONTHLY" ? "RITMO MENSUAL" : "RITMO ANUAL"}</Tag>
                    </View>
                  </View>
                  <Text accessibilityRole="header" style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                  <Text style={[styles.goalCaption, { color: colors.muted }]}>Destino planeado</Text>
                  <Text style={[styles.goalTotal, { color: colors.primary }]}>{goal.projectionBlocked ? "Revisar datos" : formatCop(goal.projectedTotal)}</Text>
                  <View style={[styles.goalDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.goalFacts}>
                    <View style={styles.goalFact}>
                      <Text style={[styles.factLabel, { color: colors.muted }]}>Aporte</Text>
                      <Text style={[styles.factValue, { color: colors.text }]}>{formatCop(goal.periodicAmount)}</Text>
                    </View>
                    <View style={styles.goalFact}>
                      <Text style={[styles.factLabel, { color: colors.muted }]}>Duración</Text>
                      <Text style={[styles.factValue, { color: colors.text }]}>
                        {goal.numberOfPeriods === undefined ? "Según configuración" : `${goal.numberOfPeriods} ${goal.periodicity === "MONTHLY" ? "meses" : "años"}`}
                      </Text>
                    </View>
                    {goal.projectionMode === "ADVANCED" ? (
                      <View style={styles.goalFact}>
                        <Text style={[styles.factLabel, { color: colors.muted }]}>Saldo real</Text>
                        <Text style={[styles.factValue, { color: colors.text }]}>{formatCop(goal.actualBalance)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.zeroYield, { backgroundColor: colors.background }]}>
                    <View style={[styles.zeroDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.zeroText, { color: colors.muted }]}>Rendimiento proyectado {formatCop(goal.projectedYield)} · Estado {goal.status.toLowerCase()}</Text>
                  </View>
                </AppCard>
                <AppButton
                  accessibilityHint="Abre proyección, realidad, historial y estado"
                  label="Abrir detalle"
                  onPress={() => router.push({ pathname: MOBILE_ROUTES.goalDetail, params: { id: goal.id } })}
                  variant="secondary"
                />
              </View>
            ))}
          </View>
        ) : null}

        {goals.length > 0 ? (
          <View style={styles.actions}>
            <AppButton
              disabled={!ready || busy}
              label="Añadir otra meta"
              onPress={() => router.push(MOBILE_ROUTES.createGoal)}
            />
            <AppButton
              accessibilityHint="Abre exportación e importación de copias"
              disabled={!ready || busy}
              label="Cuidar mis datos"
              onPress={() => router.push(MOBILE_ROUTES.data)}
              variant="secondary"
            />
          </View>
        ) : null}

        {ready && goals.length === 0 ? (
          <AppButton
            accessibilityHint="Abre exportación e importación de copias"
            disabled={busy}
            label="Copias y privacidad"
            onPress={() => router.push(MOBILE_ROUTES.data)}
            variant="quiet"
          />
        ) : null}

        <Text style={[styles.disclaimer, { color: colors.muted }]}>La proyección muestra valores brutos estimados. No incluye retenciones, impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor real puede ser menor.</Text>
      </View>
    </ScrollView>
  );
}

function RouteMotif() {
  const colors = useAppColors();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.routeMotif}>
      {[12, 24, 38].map((height, index) => (
        <View key={height} style={[styles.routeBar, { backgroundColor: index === 2 ? colors.accent : colors.primary, height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: "center", flexGrow: 1 },
  container: { gap: APP_SPACING.xl, maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 44, paddingHorizontal: 20, paddingTop: 28, width: "100%" },
  centered: { alignItems: "center", gap: APP_SPACING.sm, justifyContent: "center", minHeight: 180 },
  loadingText: { fontSize: 15, fontWeight: "600" },
  hero: { gap: APP_SPACING.sm, overflow: "hidden" },
  heroTop: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.sm, justifyContent: "space-between" },
  heroLabel: { fontSize: 14, fontWeight: "700", marginTop: APP_SPACING.xs },
  heroTotal: { fontSize: 37, fontWeight: "900", letterSpacing: -1.4 },
  heroRule: { borderRadius: 2, height: 4, marginTop: APP_SPACING.xs, width: 56 },
  heroFootnote: { fontSize: 14, lineHeight: 20 },
  routeMotif: { alignItems: "flex-end", flexDirection: "row", gap: 5, height: 40 },
  routeBar: { borderRadius: 4, width: 7 },
  empty: { gap: APP_SPACING.md },
  emptyTitle: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 22 },
  goalsSection: { gap: APP_SPACING.md },
  goalContainer: { gap: APP_SPACING.xs },
  goalCard: { gap: APP_SPACING.xs },
  cardTags: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs },
  goalTopline: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs, justifyContent: "space-between" },
  goalIndex: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  goalName: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4, lineHeight: 29, marginBottom: APP_SPACING.sm },
  goalCaption: { fontSize: 13, fontWeight: "700" },
  goalTotal: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  goalDivider: { height: 1, marginVertical: APP_SPACING.sm },
  goalFacts: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.lg },
  goalFact: { flexGrow: 1, minWidth: 120 },
  factLabel: { fontSize: 12, fontWeight: "700", marginBottom: 3, textTransform: "uppercase" },
  factValue: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
  zeroYield: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: APP_SPACING.xs, marginTop: APP_SPACING.sm, padding: APP_SPACING.sm },
  zeroDot: { borderRadius: 4, height: 8, width: 8 },
  zeroText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  actions: { gap: APP_SPACING.sm },
  disclaimer: { fontSize: 12, lineHeight: 18, paddingHorizontal: APP_SPACING.xs },
});
