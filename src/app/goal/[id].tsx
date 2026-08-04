import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MOBILE_ROUTES } from "../../application/mobile-navigation.js";
import type { GoalDetailView } from "../../application/mobile-savings-service.js";
import type { GoalStatus } from "../../domain/models.js";
import { useApp } from "../../mobile/presentation/app-provider.js";
import { formatCop } from "../../mobile/presentation/format.js";
import { useAppColors } from "../../mobile/presentation/theme.js";
import {
  AppButton,
  AppCard,
  PageIntro,
  SectionHeading,
  StatusMessage,
  Tag,
} from "../../mobile/presentation/ui.js";
import {
  APP_RADII,
  APP_SPACING,
  MAX_CONTENT_WIDTH,
} from "../../mobile/presentation/visual-system.js";

const STATUS_LABELS: Readonly<Record<GoalStatus, string>> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
  ARCHIVED: "Archivada",
};

const MOVEMENT_LABELS = {
  CONTRIBUTION: "Aporte",
  EXTRA_CONTRIBUTION: "Aporte extraordinario",
  YIELD: "Rendimiento real",
  WITHDRAWAL: "Retiro",
  ADJUSTMENT: "Ajuste",
} as const;

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ readonly id: string }>();
  const router = useRouter();
  const colors = useAppColors();
  const {
    getGoal,
    changeGoalStatus,
    closeActualPeriod,
    voidMovement,
    reviseAdvancedContribution,
    convertAdvancedGoalToSimple,
    busy,
  } = useApp();
  const [detail, setDetail] = useState<GoalDetailView>();
  const [localError, setLocalError] = useState<string>();
  const [closeDate, setCloseDate] = useState("");
  const [revisionAmount, setRevisionAmount] = useState("");
  const [revisionDate, setRevisionDate] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [voidingMovementId, setVoidingMovementId] = useState<string>();
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    if (typeof id !== "string" || id.length === 0) return;
    try {
      setLocalError(undefined);
      const loaded = await getGoal(id);
      setDetail(loaded);
      setRevisionAmount(loaded.periodicAmount);
      setRevisionDate(loaded.latestClose?.periodEnd ?? "");
    } catch {
      setLocalError("No fue posible reconstruir esta meta.");
    }
  }, [getGoal, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setStatus = (status: GoalStatus) => {
    if (detail === undefined) return;
    const apply = async () => {
      try {
        setDetail(await changeGoalStatus(detail.id, status));
      } catch {
        setLocalError("No fue posible cambiar el estado.");
      }
    };
    if (status === "ARCHIVED") {
      Alert.alert(
        "Archivar meta",
        `Se ocultará del trabajo cotidiano, pero ${detail.name} y todo su historial se conservarán.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Archivar", style: "destructive", onPress: () => void apply() },
        ],
      );
    } else {
      void apply();
    }
  };

  const closePeriod = async () => {
    if (detail === undefined || closeDate.trim().length === 0) return;
    try {
      setDetail(await closeActualPeriod(detail.id, closeDate.trim()));
      setCloseDate("");
    } catch {
      setLocalError("Revisa la fecha del cierre y los movimientos del periodo.");
    }
  };

  const confirmVoid = async () => {
    if (
      detail === undefined ||
      voidingMovementId === undefined ||
      voidReason.trim().length === 0
    ) return;
    try {
      setDetail(
        await voidMovement(detail.id, voidingMovementId, voidReason.trim()),
      );
      setVoidingMovementId(undefined);
      setVoidReason("");
    } catch {
      setLocalError("No fue posible anular el movimiento.");
    }
  };

  const revisePlan = async () => {
    if (detail === undefined) return;
    try {
      const revised = await reviseAdvancedContribution({
        goalId: detail.id,
        periodicAmount: revisionAmount,
        effectiveFrom: revisionDate,
        reason: revisionReason,
      });
      setDetail(revised);
      setRevisionReason("");
    } catch {
      setLocalError(
        "La revisión necesita un aporte válido, motivo y vigencia igual al cierre vigente.",
      );
    }
  };

  const confirmSimpleMode = () => {
    if (detail === undefined) return;
    Alert.alert(
      "Usar proyección simple",
      "La tasa, el saldo real y las revisiones avanzadas dejarán de influir en el cálculo visible, pero no se borrarán.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Conservar y cambiar",
          onPress: () =>
            void convertAdvancedGoalToSimple({
              goalId: detail.id,
              periodicAmount: detail.periodicAmount,
              periodicity: detail.periodicity,
              numberOfPeriods: detail.numberOfPeriods ?? 1,
              startDate: detail.startDate ?? detail.configurationEffectiveFrom,
            })
              .then(setDetail)
              .catch(() =>
                setLocalError("No fue posible cambiar a la proyección simple."),
              ),
        },
      ],
    );
  };

  if (detail === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {localError === undefined ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <StatusMessage tone="danger">{localError}</StatusMessage>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.scrollContent}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.container}>
        <PageIntro
          description={detail.projectionMode === "ADVANCED" ? "Plan, realidad y proyección permanecen separados." : "Este recorrido solo suma aportes planeados."}
          eyebrow={detail.projectionMode === "ADVANCED" ? "Ruta avanzada" : "Ruta simple"}
          title={detail.name}
        />

        {localError === undefined ? null : (
          <StatusMessage tone="danger">{localError}</StatusMessage>
        )}

        <View style={styles.tags}>
          <Tag>{STATUS_LABELS[detail.status].toUpperCase()}</Tag>
          <Tag accent>{detail.projectionMode === "ADVANCED" ? "SEGUIMIENTO REAL" : "SOLO PLAN"}</Tag>
          <Tag>REVISIÓN {detail.configurationRevisionNumber}</Tag>
        </View>

        <AppCard style={styles.summary} tone="primary">
          <Text style={[styles.caption, { color: colors.muted }]}>Proyección original al final</Text>
          <Text style={[styles.total, { color: colors.text }]}>{detail.projectionBlocked ? "Cálculo bloqueado" : formatCop(detail.originalProjection?.finalBalance ?? detail.projectedTotal)}</Text>
          <View style={styles.facts}>
            <Fact label="Aportes planeados" value={formatCop(detail.originalProjection?.projectedContributions ?? detail.projectedTotal)} />
            <Fact label="Rendimiento estimado" value={formatCop(detail.originalProjection?.projectedYield ?? detail.projectedYield)} />
            <Fact label="Saldo real" value={formatCop(detail.actualBalance)} />
          </View>
        </AppCard>

        {detail.projectionMode === "ADVANCED" ? (
          <>
            <View style={styles.section}>
              <SectionHeading title="Registrar la realidad" description="Solo los movimientos confirmados cambian el ahorro real." />
              <AppButton
                disabled={busy || detail.status === "ARCHIVED"}
                label="Registrar movimiento"
                onPress={() => router.push({ pathname: MOBILE_ROUTES.registerMovement, params: { id: detail.id } })}
              />
              <View style={styles.facts}>
                <Fact label="Aportes" value={formatCop(detail.actualContributions)} />
                <Fact label="Extraordinarios" value={formatCop(detail.actualExtraContributions)} />
                <Fact label="Rendimiento real" value={formatCop(detail.actualYield)} />
                <Fact label="Retiros" value={formatCop(detail.actualWithdrawals)} />
                <Fact label="Ajustes" value={formatCop(detail.adjustments)} />
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading title="Corte y comparación" description="Un cierre fija el saldo real de una fecha sin reescribir el plan original." />
              <TextInput
                accessibilityLabel="Fecha final del cierre"
                autoCapitalize="none"
                maxLength={10}
                onChangeText={setCloseDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
                value={closeDate}
              />
              <AppButton disabled={busy || closeDate.length !== 10} label="Crear cierre real" onPress={() => void closePeriod()} variant="secondary" />
              {detail.latestClose === undefined ? (
                <Text style={[styles.body, { color: colors.muted }]}>Todavía no existe un cierre vigente.</Text>
              ) : (
                <AppCard>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Cierre al {detail.latestClose.periodEnd}</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>Saldo real: {formatCop(detail.latestClose.closingBalance)}</Text>
                  {detail.comparison === undefined ? null : (
                    <Text style={[styles.body, { color: colors.muted }]}>Estado frente al plan: {detail.comparison.scheduleStatus === "AHEAD" ? "adelantado" : detail.comparison.scheduleStatus === "BEHIND" ? "retrasado" : "al día"}. Diferencia: {formatCop(detail.comparison.balanceDifference)}.</Text>
                  )}
                  {detail.updatedProjection === undefined ? null : (
                    <Text style={[styles.body, { color: colors.muted }]}>Proyección actualizada: {formatCop(detail.updatedProjection.finalBalance)} desde el saldo real del cierre.</Text>
                  )}
                </AppCard>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeading
                title="Revisar un supuesto"
                description="El plan original queda intacto. La nueva vigencia debe coincidir con el cierre real vigente."
              />
              <TextInput
                accessibilityLabel="Nuevo aporte por periodo"
                keyboardType="decimal-pad"
                onChangeText={setRevisionAmount}
                placeholder="Nuevo aporte"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
                value={revisionAmount}
              />
              <TextInput
                accessibilityLabel="Fecha de vigencia de la revisión"
                autoCapitalize="none"
                maxLength={10}
                onChangeText={setRevisionDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
                value={revisionDate}
              />
              <TextInput
                accessibilityLabel="Motivo de la revisión"
                maxLength={500}
                onChangeText={setRevisionReason}
                placeholder="¿Qué cambió?"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
                value={revisionReason}
              />
              <AppButton
                disabled={busy || detail.latestClose === undefined || revisionReason.trim().length === 0}
                label="Guardar nueva revisión"
                onPress={() => void revisePlan()}
                variant="secondary"
              />
              {detail.latestClose === undefined ? (
                <Text style={[styles.body, { color: colors.muted }]}>Crea primero un cierre real para fijar la vigencia sin alterar el pasado.</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionHeading title="Historial" description="Corregir no borra: una anulación conserva su revisión." />
              {detail.movements.length === 0 ? (
                <Text style={[styles.body, { color: colors.muted }]}>Aún no hay movimientos confirmados.</Text>
              ) : detail.movements.map((movement) => (
                <AppCard key={movement.id} style={styles.movement}>
                  <View style={styles.movementTop}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{MOVEMENT_LABELS[movement.type]}</Text>
                    <Tag accent={movement.status === "VOIDED"}>{movement.status === "VOIDED" ? "ANULADO" : movement.effectiveDate}</Tag>
                  </View>
                  <Text style={[styles.movementAmount, { color: colors.primary }]}>{formatCop(movement.amount)}</Text>
                  {movement.note === undefined ? null : <Text style={[styles.body, { color: colors.muted }]}>{movement.note}</Text>}
                  {movement.status === "ACTIVE" ? (
                    voidingMovementId === movement.id ? (
                      <View style={styles.voidForm}>
                        <TextInput
                          accessibilityLabel="Motivo de la anulación"
                          maxLength={500}
                          onChangeText={setVoidReason}
                          placeholder="Motivo obligatorio"
                          placeholderTextColor={colors.muted}
                          style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
                          value={voidReason}
                        />
                        <AppButton disabled={voidReason.trim().length === 0} label="Confirmar anulación" onPress={() => void confirmVoid()} variant="danger" />
                        <AppButton label="Cancelar" onPress={() => { setVoidingMovementId(undefined); setVoidReason(""); }} variant="quiet" />
                      </View>
                    ) : (
                      <AppButton label="Anular con trazabilidad" onPress={() => setVoidingMovementId(movement.id)} variant="danger" />
                    )
                  ) : null}
                </AppCard>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.section}>
          <SectionHeading title="Estado de la meta" description="Pausar o completar es reversible. Archivar conserva todos los datos." />
          <View style={styles.actions}>
            <AppButton label="Marcar activa" onPress={() => setStatus("ACTIVE")} variant="quiet" />
            <AppButton label="Pausar" onPress={() => setStatus("PAUSED")} variant="secondary" />
            <AppButton label="Completar" onPress={() => setStatus("COMPLETED")} variant="secondary" />
            <AppButton label="Archivar" onPress={() => setStatus("ARCHIVED")} variant="danger" />
            {detail.projectionMode === "ADVANCED" ? (
              <AppButton label="Cambiar a proyección simple" onPress={confirmSimpleMode} variant="danger" />
            ) : null}
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: colors.muted }]}>La proyección muestra valores brutos estimados. No incluye retenciones, impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor real puede ser menor.</Text>
      </View>
    </ScrollView>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  const colors = useAppColors();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", flex: 1, justifyContent: "center", padding: APP_SPACING.xl },
  scrollContent: { alignItems: "center", flexGrow: 1 },
  container: { gap: APP_SPACING.xl, maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 44, paddingHorizontal: 20, paddingTop: APP_SPACING.md, width: "100%" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs },
  summary: { gap: APP_SPACING.sm },
  caption: { fontSize: 13, fontWeight: "700" },
  total: { fontSize: 33, fontWeight: "900", letterSpacing: -1 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.md },
  fact: { flexGrow: 1, minWidth: 135 },
  factLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  factValue: { fontSize: 17, fontWeight: "900", lineHeight: 24 },
  section: { gap: APP_SPACING.md },
  input: { borderRadius: APP_RADII.medium, borderWidth: 1.5, fontSize: 17, minHeight: 54, paddingHorizontal: APP_SPACING.md },
  body: { fontSize: 14, lineHeight: 21 },
  cardTitle: { fontSize: 17, fontWeight: "900", lineHeight: 23 },
  movement: { gap: APP_SPACING.sm },
  movementTop: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.sm, justifyContent: "space-between" },
  movementAmount: { fontSize: 24, fontWeight: "900" },
  actions: { gap: APP_SPACING.xs },
  voidForm: { gap: APP_SPACING.xs },
  disclaimer: { fontSize: 12, lineHeight: 18 },
});
