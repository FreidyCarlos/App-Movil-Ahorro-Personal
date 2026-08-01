import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

import {
  validateSimpleGoalForm,
  type SimpleGoalFormErrors,
} from "../application/simple-goal-form.js";
import { MOBILE_ROUTES } from "../application/mobile-navigation.js";
import type { SimplePeriodicity } from "../domain/models.js";
import { useApp } from "../mobile/presentation/app-provider.js";
import { formatCop } from "../mobile/presentation/format.js";
import { useAppColors } from "../mobile/presentation/theme.js";

export default function NewGoalScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { busy, createSimpleGoal } = useApp();
  const [name, setName] = useState("");
  const [periodicAmount, setPeriodicAmount] = useState("");
  const [periodicity, setPeriodicity] =
    useState<SimplePeriodicity>("MONTHLY");
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

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          Proyección simple
        </Text>
        <Text style={[styles.help, { color: colors.muted }]}>
          Solo sumaremos el mismo aporte en cada periodo. Esta proyección no
          inventa intereses ni rendimientos.
        </Text>

        <FieldLabel text="Nombre de la meta" color={colors.text} />
        <TextInput
          accessibilityLabel="Nombre de la meta"
          autoCapitalize="sentences"
          maxLength={80}
          onChangeText={setName}
          placeholder="Ej. Fondo de emergencia"
          placeholderTextColor={colors.muted}
          style={inputStyle}
          value={name}
        />
        <FieldError message={errors.name} color={colors.danger} />

        <FieldLabel text="Monto por periodo (COP)" color={colors.text} />
        <TextInput
          accessibilityLabel="Monto por periodo en pesos colombianos"
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={11}
          onChangeText={setPeriodicAmount}
          placeholder="200000"
          placeholderTextColor={colors.muted}
          style={inputStyle}
          value={periodicAmount}
        />
        <FieldError message={errors.periodicAmount} color={colors.danger} />

        <FieldLabel text="Frecuencia" color={colors.text} />
        <View accessibilityRole="radiogroup" style={styles.segment}>
          {(["MONTHLY", "YEARLY"] as const).map((value) => {
            const selected = periodicity === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setPeriodicity(value)}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.primaryText : colors.text,
                    fontWeight: "700",
                  }}
                >
                  {value === "MONTHLY" ? "Mensual" : "Anual"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FieldLabel
          text={periodicity === "MONTHLY" ? "Cantidad de meses" : "Cantidad de años"}
          color={colors.text}
        />
        <TextInput
          accessibilityLabel={
            periodicity === "MONTHLY" ? "Cantidad de meses" : "Cantidad de años"
          }
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={setNumberOfPeriods}
          placeholder={periodicity === "MONTHLY" ? "18" : "5"}
          placeholderTextColor={colors.muted}
          style={inputStyle}
          value={numberOfPeriods}
        />
        <FieldError message={errors.numberOfPeriods} color={colors.danger} />

        <FieldLabel text="Fecha inicial (opcional)" color={colors.text} />
        <TextInput
          accessibilityLabel="Fecha inicial opcional"
          autoCapitalize="none"
          inputMode="text"
          maxLength={10}
          onChangeText={setStartDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={colors.muted}
          style={inputStyle}
          value={startDate}
        />
        <FieldError message={errors.startDate} color={colors.danger} />

        {preview.success ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.preview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.muted }}>Total proyectado</Text>
            <Text style={[styles.total, { color: colors.primary }]}>
              {formatCop(preview.projectedTotal)}
            </Text>
            <Text style={{ color: colors.muted }}>
              Rendimiento proyectado: {formatCop("0")}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: busy || pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>
            {busy ? "Guardando…" : "Guardar meta"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ text, color }: { readonly text: string; readonly color: string }) {
  return <Text style={[styles.label, { color }]}>{text}</Text>;
}

function FieldError({
  message,
  color,
}: {
  readonly message: string | undefined;
  readonly color: string;
}) {
  return message === undefined ? null : (
    <Text accessibilityLiveRegion="polite" style={{ color }}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: "800" },
  help: { fontSize: 16, lineHeight: 23, marginBottom: 8 },
  label: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 17 },
  segment: { flexDirection: "row", gap: 10 },
  segmentButton: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 5, marginTop: 8 },
  total: { fontSize: 25, fontWeight: "800" },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 17, fontWeight: "700" },
});
