import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  View,
} from "react-native";

import { MOBILE_ROUTES } from "../application/mobile-navigation.js";
import {
  validateAdvancedGoalForm,
  type AdvancedGoalFormErrors,
  type AdvancedYieldChoice,
  type OtherSupportedRateType,
} from "../application/advanced-goal-form.js";
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

const YIELD_CHOICES: readonly {
  readonly value: AdvancedYieldChoice;
  readonly label: string;
  readonly help: string;
}[] = [
  { value: "ZERO", label: "Sin rendimiento", help: "Tasa cero explícita." },
  { value: "EA", label: "Tengo una tasa E.A.", help: "Conserva el porcentaje anual publicado." },
  { value: "OTHER", label: "Tengo otro tipo de tasa", help: "Permite una expresión soportada." },
  { value: "UNKNOWN", label: "No estoy seguro", help: "Bloquea el cálculo hasta completar los datos." },
];

const OTHER_RATES: readonly {
  readonly value: OtherSupportedRateType;
  readonly label: string;
}[] = [
  { value: "EM", label: "E.M." },
  { value: "ET", label: "E.T." },
  { value: "ES", label: "E.S." },
  { value: "NMV", label: "N.M.V." },
  { value: "NTV", label: "N.T.V." },
  { value: "NOMINAL_ANNUAL_DUE", label: "Nominal anual vencida" },
];

export default function NewGoalScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollPosition = useRef(0);
  const nameInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);
  const periodsInputRef = useRef<TextInput>(null);
  const dateInputRef = useRef<TextInput>(null);
  const { busy, createSimpleGoal, createAdvancedGoal } = useApp();
  const [name, setName] = useState("");
  const [periodicAmount, setPeriodicAmount] = useState("");
  const [periodicity, setPeriodicity] = useState<SimplePeriodicity>("MONTHLY");
  const [numberOfPeriods, setNumberOfPeriods] = useState("");
  const [startDate, setStartDate] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [initialBalance, setInitialBalance] = useState("0");
  const [targetAmount, setTargetAmount] = useState("");
  const [yieldChoice, setYieldChoice] =
    useState<AdvancedYieldChoice>("ZERO");
  const [rateValue, setRateValue] = useState("");
  const [otherRateType, setOtherRateType] =
    useState<OtherSupportedRateType>("EM");
  const [capitalizationPeriodsPerYear, setCapitalizationPeriodsPerYear] =
    useState("");
  const [errors, setErrors] = useState<
    SimpleGoalFormErrors & AdvancedGoalFormErrors
  >({});

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

  const advancedPreview = useMemo(
    () =>
      validateAdvancedGoalForm({
        name,
        periodicAmount,
        periodicity,
        numberOfPeriods,
        startDate,
        targetAmount,
        initialBalance,
        yieldChoice,
        rateValue,
        otherRateType,
        capitalizationPeriodsPerYear,
      }),
    [
      name,
      periodicAmount,
      periodicity,
      numberOfPeriods,
      startDate,
      targetAmount,
      initialBalance,
      yieldChoice,
      rateValue,
      otherRateType,
      capitalizationPeriodsPerYear,
    ],
  );

  const submit = async () => {
    if (advanced) {
      const validation = validateAdvancedGoalForm({
        name,
        periodicAmount,
        periodicity,
        numberOfPeriods,
        startDate,
        targetAmount,
        initialBalance,
        yieldChoice,
        rateValue,
        otherRateType,
        capitalizationPeriodsPerYear,
      });
      if (!validation.success) {
        setErrors(validation.errors);
        return;
      }
      setErrors({});
      try {
        await createAdvancedGoal(validation.data);
        router.replace(MOBILE_ROUTES.home);
      } catch {
        // El proveedor mantiene el error seguro y la transacción revierte.
      }
      return;
    }
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

  const toggleAdvanced = (next: boolean) => {
    if (
      !next &&
      (initialBalance !== "0" ||
        targetAmount.length > 0 ||
        yieldChoice !== "ZERO" ||
        rateValue.length > 0)
    ) {
      Alert.alert(
        "Volver a proyección simple",
        "El saldo inicial, objetivo y tasa dejarán de influir. Los campos básicos se conservarán y nada se guardará hasta confirmar la meta.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar en simple", onPress: () => setAdvanced(false) },
        ],
      );
      return;
    }
    setAdvanced(next);
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

          <AppCard style={styles.advancedCard} tone={advanced ? "primary" : "plain"}>
            <View style={styles.advancedToggleRow}>
              <View style={styles.advancedToggleCopy}>
                <Text accessibilityRole="header" style={[styles.advancedTitle, { color: colors.text }]}>Usar proyección avanzada</Text>
                <Text style={[styles.advancedHelp, { color: colors.muted }]}>Añade saldo real, objetivo y rendimiento sin perder nombre, aporte ni duración.</Text>
              </View>
              <Switch
                accessibilityLabel="Usar proyección avanzada"
                accessibilityState={{ checked: advanced }}
                onValueChange={toggleAdvanced}
                thumbColor={advanced ? colors.accent : colors.surfaceRaised}
                trackColor={{ false: colors.border, true: colors.primary }}
                value={advanced}
              />
            </View>
          </AppCard>

          {advanced ? (
            <View style={styles.formSection}>
              <SectionHeading
                description="Estos valores separan el plan del ahorro confirmado. Ninguno consulta una cuenta bancaria."
                number="04"
                title="Añade el contexto real"
              />
              <FieldLabel text="Saldo inicial (COP)" />
              <TextInput
                accessibilityLabel="Saldo inicial en pesos colombianos"
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={11}
                onChangeText={setInitialBalance}
                placeholder="0"
                placeholderTextColor={colors.muted}
                selectionColor={colors.focus}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: errors.initialBalance === undefined ? colors.border : colors.danger, color: colors.text }]}
                value={initialBalance}
              />
              <FieldError message={errors.initialBalance} />

              <FieldLabel text="Objetivo monetario (opcional)" />
              <TextInput
                accessibilityLabel="Objetivo monetario opcional en pesos colombianos"
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={11}
                onChangeText={setTargetAmount}
                placeholder="1000000"
                placeholderTextColor={colors.muted}
                selectionColor={colors.focus}
                style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: errors.targetAmount === undefined ? colors.border : colors.danger, color: colors.text }]}
                value={targetAmount}
              />
              <FieldError message={errors.targetAmount} />

              <FieldLabel text="¿Cómo deseas proyectar el rendimiento?" />
              <View accessibilityRole="radiogroup" style={styles.rateChoices}>
                {YIELD_CHOICES.map((choice) => {
                  const selected = yieldChoice === choice.value;
                  return (
                    <Pressable
                      accessibilityLabel={choice.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={choice.value}
                      onPress={() => setYieldChoice(choice.value)}
                      style={({ pressed }) => [styles.rateChoice, { backgroundColor: selected ? colors.primarySoft : colors.surfaceRaised, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.72 : 1 }]}
                    >
                      <View style={[styles.radioDot, { borderColor: colors.primary }]}>
                        {selected ? <View style={[styles.radioFill, { backgroundColor: colors.primary }]} /> : null}
                      </View>
                      <View style={styles.rateChoiceCopy}>
                        <Text style={[styles.rateChoiceLabel, { color: colors.text }]}>{choice.label}</Text>
                        <Text style={[styles.rateChoiceHelp, { color: colors.muted }]}>{choice.help}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <FieldError message={errors.yieldChoice} />

              {yieldChoice === "EA" || yieldChoice === "OTHER" ? (
                <>
                  {yieldChoice === "OTHER" ? (
                    <>
                      <FieldLabel text="Tipo de tasa" />
                      <View accessibilityRole="radiogroup" style={styles.otherRates}>
                        {OTHER_RATES.map((rate) => {
                          const selected = otherRateType === rate.value;
                          return (
                            <Pressable
                              accessibilityLabel={`Tipo de tasa ${rate.label}`}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              key={rate.value}
                              onPress={() => setOtherRateType(rate.value)}
                              style={({ pressed }) => [styles.rateChip, { backgroundColor: selected ? colors.primary : colors.surfaceRaised, borderColor: colors.primary, opacity: pressed ? 0.72 : 1 }]}
                            >
                              <Text style={[styles.rateChipText, { color: selected ? colors.primaryText : colors.primary }]}>{rate.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  <FieldLabel text="Tasa publicada (%)" />
                  <TextInput
                    accessibilityHint="Escribe el porcentaje, por ejemplo 9.5"
                    accessibilityLabel="Valor original de la tasa en porcentaje"
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    maxLength={12}
                    onChangeText={setRateValue}
                    placeholder="9.5"
                    placeholderTextColor={colors.muted}
                    selectionColor={colors.focus}
                    style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: errors.rateValue === undefined ? colors.border : colors.danger, color: colors.text }]}
                    value={rateValue}
                  />
                  <FieldError message={errors.rateValue} />
                  {yieldChoice === "OTHER" && otherRateType === "NOMINAL_ANNUAL_DUE" ? (
                    <>
                      <FieldLabel text="Capitalizaciones por año" />
                      <TextInput
                        accessibilityLabel="Capitalizaciones por año"
                        inputMode="numeric"
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={setCapitalizationPeriodsPerYear}
                        placeholder="12"
                        placeholderTextColor={colors.muted}
                        selectionColor={colors.focus}
                        style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: errors.capitalizationPeriodsPerYear === undefined ? colors.border : colors.danger, color: colors.text }]}
                        value={capitalizationPeriodsPerYear}
                      />
                      <FieldError message={errors.capitalizationPeriodsPerYear} />
                    </>
                  ) : null}
                </>
              ) : null}

              {yieldChoice === "UNKNOWN" ? (
                <View style={[styles.unknownHelp, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.unknownTitle, { color: colors.accent }]}>Busca estos datos antes de continuar</Text>
                  <Text style={[styles.unknownText, { color: colors.text }]}>Abreviatura exacta, periodo, efectiva o nominal, capitalización, vencida o anticipada, vigencia y forma de pago. La app no reemplazará lo desconocido por cero.</Text>
                </View>
              ) : null}

              <Text style={[styles.disclaimer, { color: colors.muted }]}>La proyección muestra valores brutos estimados. No incluye retenciones, impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor real puede ser menor.</Text>
            </View>
          ) : null}

          {(advanced ? advancedPreview : preview).success ? (
            <AppCard
              accessibilityLabel={`Vista previa de ${advanced ? "proyección avanzada" : "proyección simple"}`}
              accessible
              style={styles.preview}
              tone="accent"
            >
              <View style={styles.previewTop}>
                <Tag accent>VISTA PREVIA</Tag>
                <Text style={[styles.previewEquation, { color: colors.muted }]}>
                  {formatCop(periodicAmount || "0")} × {numberOfPeriods || "0"}
                </Text>
              </View>
              <Text style={[styles.previewLabel, { color: colors.muted }]}>Total de aportes planeados</Text>
              <Text style={[styles.previewTotal, { color: colors.text }]}>
                {formatCop(
                  advanced && advancedPreview.success
                    ? advancedPreview.projectedContributions
                    : preview.success
                      ? preview.projectedTotal
                      : "0",
                )}
              </Text>
              <View style={[styles.previewNote, { backgroundColor: colors.background }]}>
                <Text style={[styles.previewNoteText, { color: colors.muted }]}>
                  {advanced
                    ? "El saldo inicial y el rendimiento se verán por separado en el detalle."
                    : `Sin una tasa, el rendimiento proyectado es ${formatCop("0")}.`}
                </Text>
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
          <Text style={[styles.disclaimer, { color: colors.muted }]}>{advanced ? "Esta meta guardará supuestos avanzados y habilitará el registro real." : "Esta meta guarda una proyección simple en COP."} No conecta bancos ni mueve dinero.</Text>
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
  advancedCard: { gap: APP_SPACING.sm },
  advancedToggleRow: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.md, justifyContent: "space-between" },
  advancedToggleCopy: { flex: 1, gap: 4 },
  advancedTitle: { fontSize: 18, fontWeight: "900", lineHeight: 23 },
  advancedHelp: { fontSize: 13, lineHeight: 19 },
  rateChoices: { gap: APP_SPACING.xs },
  rateChoice: { alignItems: "center", borderRadius: APP_RADII.medium, borderWidth: 1.5, flexDirection: "row", gap: APP_SPACING.sm, minHeight: MINIMUM_TOUCH_TARGET, padding: APP_SPACING.sm },
  radioDot: { alignItems: "center", borderRadius: 10, borderWidth: 2, height: 20, justifyContent: "center", width: 20 },
  radioFill: { borderRadius: 5, height: 10, width: 10 },
  rateChoiceCopy: { flex: 1, gap: 2 },
  rateChoiceLabel: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  rateChoiceHelp: { fontSize: 12, lineHeight: 17 },
  otherRates: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs },
  rateChip: { alignItems: "center", borderRadius: APP_RADII.pill, borderWidth: 1.5, justifyContent: "center", minHeight: MINIMUM_TOUCH_TARGET, paddingHorizontal: APP_SPACING.md },
  rateChipText: { fontSize: 13, fontWeight: "800" },
  unknownHelp: { borderRadius: APP_RADII.medium, gap: 4, padding: APP_SPACING.md },
  unknownTitle: { fontSize: 15, fontWeight: "900" },
  unknownText: { fontSize: 13, lineHeight: 19 },
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
