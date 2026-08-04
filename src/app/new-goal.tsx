import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MOBILE_ROUTES } from "../application/mobile-navigation.js";
import {
  validateSimpleGoalForm,
  type SimpleGoalFormErrors,
} from "../application/simple-goal-form.js";
import type { SimplePeriodicity } from "../domain/models.js";
import { useApp } from "../mobile/presentation/app-provider.js";
import { formatCop } from "../mobile/presentation/format.js";
import { useAppColors } from "../mobile/presentation/theme.js";
import {
  AppButton,
  AppCard,
  PageIntro,
  SectionHeading,
  Tag,
} from "../mobile/presentation/ui.js";
import {
  APP_RADII,
  APP_SPACING,
  MAX_CONTENT_WIDTH,
  MINIMUM_TOUCH_TARGET,
} from "../mobile/presentation/visual-system.js";

export default function NewGoalScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollPosition = useRef(0);
  const nameInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);
  const periodsInputRef = useRef<TextInput>(null);
  const dateInputRef = useRef<TextInput>(null);
  const { busy, createSimpleGoal } = useApp();
  const [name, setName] = useState("");
  const [periodicAmount, setPeriodicAmount] = useState("");
  const [periodicity, setPeriodicity] = useState<SimplePeriodicity>("MONTHLY");
  const [numberOfPeriods, setNumberOfPeriods] = useState("");
  const [startDate, setStartDate] = useState("");
  const [errors, setErrors] = useState<SimpleGoalFormErrors>({});

  const preview = useMemo(
    () =>
      validateSimpleGoalForm({
        name,
        periodicAmount,
        periodicity,
        numberOfPeriods,
        startDate,
      }),
    [name, periodicAmount, periodicity, numberOfPeriods, startDate],
  );

  const submit = async () => {
    const validation = validateSimpleGoalForm({
      name,
      periodicAmount,
      periodicity,
      numberOfPeriods,
      startDate,
    });
    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    try {
      await createSimpleGoal(validation.data);
      router.replace(MOBILE_ROUTES.home);
    } catch {
      // El proveedor ya expone un mensaje seguro y no registra los datos.
    }
  };

  const changePeriods = (delta: number) => {
    const maximum = periodicity === "MONTHLY" ? 1200 : 100;
    const current = /^\d+$/.test(numberOfPeriods) ? Number(numberOfPeriods) : 0;
    setNumberOfPeriods(String(Math.min(maximum, Math.max(1, current + delta))));
  };

  const revealInput = (target: TextInput | null) => {
    setTimeout(() => {
      if (target === null) {
        return;
      }
      target.measureInWindow((_x, y) => {
        scrollRef.current?.scrollTo({
          animated: false,
          y: Math.max(0, scrollPosition.current + y - 150),
        });
      });
    }, 400);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      style={styles.flex}
    >
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          scrollPosition.current = event.nativeEvent.contentOffset.y;
        }}
        ref={scrollRef}
        scrollEventThrottle={16}
        style={{ backgroundColor: colors.background }}
      >
        <View style={styles.container}>
          <PageIntro
            description="Construye un plan breve y legible. Aquí no pedimos tasas ni datos bancarios."
            eyebrow="Nueva ruta"
            title="Convierte una intención en un trayecto."
          />

          <View accessibilityLabel="Tres pasos: propósito, ritmo e inicio opcional" style={styles.steps}>
            {["Propósito", "Ritmo", "Inicio"].map((label, index) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepLine, { backgroundColor: index === 2 ? colors.accent : colors.primary }]} />
                <Text style={[styles.stepLabel, { color: colors.muted }]}>{index + 1}. {label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.formSection}>
            <SectionHeading
              description="Un nombre concreto ayuda a separar este plan de los demás."
              number="01"
              title="Nombra el destino"
            />
            <FieldLabel text="Nombre de la meta" />
            <TextInput
              accessibilityHint="Por ejemplo, fondo de emergencia"
              accessibilityLabel="Nombre de la meta"
              autoCapitalize="sentences"
              maxLength={80}
              onChangeText={setName}
              onFocus={() => revealInput(nameInputRef.current)}
              placeholder="Ej. Mi colchón de tranquilidad"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
              ref={nameInputRef}
              selectionColor={colors.focus}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: errors.name === undefined ? colors.border : colors.danger,
                  color: colors.text,
                },
              ]}
              value={name}
            />
            <FieldError message={errors.name} />
          </View>

          <View style={styles.formSection}>
            <SectionHeading
              description="El ritmo combina un aporte repetible con una duración clara."
              number="02"
              title="Define el ritmo"
            />

            <FieldLabel text="Aporte por periodo (COP)" />
            <TextInput
              accessibilityHint="Escribe pesos enteros, sin puntos ni comas"
              accessibilityLabel="Monto por periodo en pesos colombianos"
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={11}
              onChangeText={setPeriodicAmount}
              onFocus={() => revealInput(amountInputRef.current)}
              placeholder="200000"
              placeholderTextColor={colors.muted}
              ref={amountInputRef}
              selectionColor={colors.focus}
              style={[
                styles.input,
                styles.moneyInput,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: errors.periodicAmount === undefined ? colors.border : colors.danger,
                  color: colors.text,
                },
              ]}
              value={periodicAmount}
            />
            <FieldError message={errors.periodicAmount} />

            <FieldLabel text="Frecuencia" />
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
              {(["MONTHLY", "YEARLY"] as const).map((value) => {
                const selected = periodicity === value;
                return (
                  <Pressable
                    accessibilityLabel={value === "MONTHLY" ? "Frecuencia mensual" : "Frecuencia anual"}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={value}
                    onPress={() => {
                      setPeriodicity(value);
                      setNumberOfPeriods("");
                    }}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      {
                        backgroundColor: selected ? colors.primary : "transparent",
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: selected ? colors.primaryText : colors.text }]}>
                      {value === "MONTHLY" ? "Cada mes" : "Cada año"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <FieldLabel text={periodicity === "MONTHLY" ? "Cantidad de meses" : "Cantidad de años"} />
            <View style={styles.periodRow}>
              <TextInput
                accessibilityLabel={periodicity === "MONTHLY" ? "Cantidad de meses" : "Cantidad de años"}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={setNumberOfPeriods}
                onFocus={() => revealInput(periodsInputRef.current)}
                placeholder={periodicity === "MONTHLY" ? "18" : "5"}
                placeholderTextColor={colors.muted}
                ref={periodsInputRef}
                selectionColor={colors.focus}
                style={[
                  styles.input,
                  styles.periodInput,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: errors.numberOfPeriods === undefined ? colors.border : colors.danger,
                    color: colors.text,
                  },
                ]}
                value={numberOfPeriods}
              />
              <Pressable
                accessibilityLabel="Quitar un periodo"
                accessibilityRole="button"
                onPress={() => changePeriods(-1)}
                style={({ pressed }) => [styles.stepper, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.stepperText, { color: colors.primary }]}>−</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Agregar un periodo"
                accessibilityRole="button"
                onPress={() => changePeriods(1)}
                style={({ pressed }) => [styles.stepper, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.stepperText, { color: colors.primary }]}>+</Text>
              </Pressable>
            </View>
            <FieldError message={errors.numberOfPeriods} />
          </View>

          <View style={styles.formSection}>
            <SectionHeading
              description="Puedes omitirla. La fecha sirve para ubicar el recorrido, no cambia la suma."
              number="03"
              title="Ubica el comienzo"
            />
            <FieldLabel text="Fecha inicial (opcional)" />
            <TextInput
              accessibilityHint="Usa cuatro dígitos para el año, dos para el mes y dos para el día"
              accessibilityLabel="Fecha inicial opcional, formato año mes día"
              autoCapitalize="none"
              inputMode="text"
              maxLength={10}
              onChangeText={setStartDate}
              onFocus={() => revealInput(dateInputRef.current)}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.muted}
              ref={dateInputRef}
              selectionColor={colors.focus}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: errors.startDate === undefined ? colors.border : colors.danger,
                  color: colors.text,
                },
              ]}
              value={startDate}
            />
            <FieldError message={errors.startDate} />
          </View>

          {preview.success ? (
            <AppCard
              accessibilityLabel={`Vista previa: total planeado ${formatCop(preview.projectedTotal)}, rendimiento proyectado cero`}
              accessible
              style={styles.preview}
              tone="accent"
            >
              <View style={styles.previewTop}>
                <Tag accent>VISTA PREVIA</Tag>
                <Text style={[styles.previewEquation, { color: colors.muted }]}>
                  {formatCop(preview.data.periodicAmount)} × {preview.data.numberOfPeriods}
                </Text>
              </View>
              <Text style={[styles.previewLabel, { color: colors.muted }]}>Total de aportes planeados</Text>
              <Text style={[styles.previewTotal, { color: colors.text }]}>{formatCop(preview.projectedTotal)}</Text>
              <View style={[styles.previewNote, { backgroundColor: colors.background }]}>
                <Text style={[styles.previewNoteText, { color: colors.muted }]}>Sin una tasa, el rendimiento proyectado es {formatCop("0")}.</Text>
              </View>
            </AppCard>
          ) : (
            <AppCard style={styles.previewPlaceholder} tone="primary">
              <Text style={[styles.previewPlaceholderTitle, { color: colors.text }]}>Tu cálculo aparecerá aquí</Text>
              <Text style={[styles.previewPlaceholderText, { color: colors.muted }]}>Completa los campos obligatorios para revisar el total antes de guardar.</Text>
            </AppCard>
          )}

          <AppButton
            accessibilityHint="Valida y guarda esta meta en el dispositivo"
            disabled={busy}
            label={busy ? "Guardando…" : "Guardar esta ruta"}
            onPress={() => void submit()}
          />
          <Text style={[styles.disclaimer, { color: colors.muted }]}>Esta meta guarda una proyección simple en COP. No conecta bancos ni mueve dinero.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ text }: { readonly text: string }) {
  const colors = useAppColors();
  return <Text style={[styles.label, { color: colors.text }]}>{text}</Text>;
}

function FieldError({ message }: { readonly message: string | undefined }) {
  const colors = useAppColors();
  return message === undefined ? null : (
    <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.fieldError, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { alignItems: "center", flexGrow: 1 },
  container: { gap: APP_SPACING.xl, maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 44, paddingHorizontal: 20, paddingTop: APP_SPACING.md, width: "100%" },
  steps: { flexDirection: "row", gap: APP_SPACING.xs },
  stepItem: { flex: 1, gap: 7 },
  stepLine: { borderRadius: 2, height: 4 },
  stepLabel: { fontSize: 11, fontWeight: "700", lineHeight: 16 },
  formSection: { gap: APP_SPACING.sm },
  label: { fontSize: 14, fontWeight: "800", marginTop: APP_SPACING.xs },
  input: { borderRadius: APP_RADII.medium, borderWidth: 1.5, fontSize: 17, minHeight: 54, paddingHorizontal: APP_SPACING.md, paddingVertical: APP_SPACING.sm },
  moneyInput: { fontSize: 22, fontWeight: "800" },
  fieldError: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  segment: { borderRadius: APP_RADII.medium, borderWidth: 1, flexDirection: "row", gap: 4, padding: 4 },
  segmentButton: { alignItems: "center", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: MINIMUM_TOUCH_TARGET },
  segmentText: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  periodRow: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.xs },
  periodInput: { flex: 1 },
  stepper: { alignItems: "center", borderRadius: APP_RADII.medium, height: 54, justifyContent: "center", width: 54 },
  stepperText: { fontSize: 25, fontWeight: "700" },
  preview: { gap: APP_SPACING.sm },
  previewTop: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.sm, justifyContent: "space-between" },
  previewEquation: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  previewLabel: { fontSize: 13, fontWeight: "700", marginTop: APP_SPACING.sm },
  previewTotal: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  previewNote: { borderRadius: APP_RADII.small, marginTop: APP_SPACING.xs, padding: APP_SPACING.sm },
  previewNoteText: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  previewPlaceholder: { gap: APP_SPACING.xs },
  previewPlaceholderTitle: { fontSize: 18, fontWeight: "800" },
  previewPlaceholderText: { fontSize: 14, lineHeight: 21 },
  disclaimer: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
