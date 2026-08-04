import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from "react-native";

import type { MovementType } from "../../../domain/models.js";
import { useApp } from "../../../mobile/presentation/app-provider.js";
import { formatCop } from "../../../mobile/presentation/format.js";
import { useAppColors } from "../../../mobile/presentation/theme.js";
import {
  AppButton,
  AppCard,
  PageIntro,
  SectionHeading,
  StatusMessage,
} from "../../../mobile/presentation/ui.js";
import {
  APP_RADII,
  APP_SPACING,
  MAX_CONTENT_WIDTH,
  MINIMUM_TOUCH_TARGET,
} from "../../../mobile/presentation/visual-system.js";

const TYPES: readonly { readonly value: MovementType; readonly label: string; readonly effect: string }[] = [
  { value: "CONTRIBUTION", label: "Aporte", effect: "Aumenta el ahorro real." },
  { value: "EXTRA_CONTRIBUTION", label: "Extraordinario", effect: "Separa un aporte fuera del ritmo." },
  { value: "YIELD", label: "Rendimiento real", effect: "Registra solo lo realmente recibido." },
  { value: "WITHDRAWAL", label: "Retiro", effect: "Resta del saldo y no puede excederlo." },
  { value: "ADJUSTMENT", label: "Ajuste", effect: "Exige una explicación y puede usar signo." },
];

export default function RegisterMovementScreen() {
  const { id } = useLocalSearchParams<{ readonly id: string }>();
  const router = useRouter();
  const colors = useAppColors();
  const { registerMovement, busy } = useApp();
  const [type, setType] = useState<MovementType>("CONTRIBUTION");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const validation = useMemo(() => {
    if (typeof id !== "string" || id.length === 0) return "La meta no es válida.";
    if (type === "ADJUSTMENT") {
      if (!/^-?[1-9]\d*$/.test(amount.trim())) return "El ajuste debe ser un entero distinto de cero.";
      if (note.trim().length === 0) return "Explica el motivo del ajuste.";
    } else if (!/^[1-9]\d*$/.test(amount.trim())) {
      return "Escribe un monto entero mayor que cero.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate.trim())) return "Usa una fecha con formato AAAA-MM-DD.";
    return undefined;
  }, [amount, effectiveDate, id, note, type]);

  const submit = async () => {
    if (validation !== undefined || typeof id !== "string") {
      setError(validation ?? "La meta no es válida.");
      return;
    }
    try {
      setError(undefined);
      await registerMovement({
        goalId: id,
        type,
        amount: amount.trim(),
        effectiveDate: effectiveDate.trim(),
        ...(note.trim().length === 0 ? {} : { note: note.trim() }),
      });
      router.back();
    } catch {
      setError("El movimiento no es válido para el saldo o producto actual.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
        <PageIntro eyebrow="Registro real" title="Anota lo que sí ocurrió." description="El plan no se convierte en ahorro hasta que confirmas un movimiento." />

        <View style={styles.section}>
          <SectionHeading title="Tipo de movimiento" description="Cada tipo mantiene su efecto separado en el desglose." />
          <View accessibilityRole="radiogroup" style={styles.types}>
            {TYPES.map((candidate) => {
              const selected = candidate.value === type;
              return (
                <Pressable
                  accessibilityLabel={candidate.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={candidate.value}
                  onPress={() => setType(candidate.value)}
                  style={({ pressed }) => [styles.type, { backgroundColor: selected ? colors.primarySoft : colors.surfaceRaised, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.72 : 1 }]}
                >
                  <Text style={[styles.typeLabel, { color: colors.text }]}>{candidate.label}</Text>
                  <Text style={[styles.typeEffect, { color: colors.muted }]}>{candidate.effect}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Monto y fecha" description="Usa pesos enteros y una fecha civil." />
          <Text style={[styles.label, { color: colors.text }]}>Monto (COP)</Text>
          <TextInput
            accessibilityHint={type === "ADJUSTMENT" ? "Puede comenzar con signo menos" : "Debe ser mayor que cero"}
            accessibilityLabel="Monto del movimiento"
            inputMode={type === "ADJUSTMENT" ? "text" : "numeric"}
            keyboardType={type === "ADJUSTMENT" ? "numbers-and-punctuation" : "number-pad"}
            maxLength={12}
            onChangeText={setAmount}
            placeholder={type === "ADJUSTMENT" ? "-5000" : "100000"}
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
            value={amount}
          />
          <Text style={[styles.label, { color: colors.text }]}>Fecha efectiva</Text>
          <TextInput
            accessibilityLabel="Fecha efectiva, formato año mes día"
            autoCapitalize="none"
            maxLength={10}
            onChangeText={setEffectiveDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
            value={effectiveDate}
          />
          <Text style={[styles.label, { color: colors.text }]}>{type === "ADJUSTMENT" ? "Explicación obligatoria" : "Nota opcional"}</Text>
          <TextInput
            accessibilityLabel={type === "ADJUSTMENT" ? "Explicación obligatoria del ajuste" : "Nota opcional"}
            maxLength={500}
            multiline
            onChangeText={setNote}
            placeholder="Describe el origen sin incluir datos bancarios"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.note, { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text }]}
            value={note}
          />
        </View>

        {amount.length > 0 && /^-?\d+$/.test(amount) ? (
          <AppCard tone="accent" style={styles.preview}>
            <Text style={[styles.previewLabel, { color: colors.muted }]}>Efecto que confirmarás</Text>
            <Text style={[styles.previewAmount, { color: colors.text }]}>{formatCop(amount)}</Text>
            <Text style={[styles.typeEffect, { color: colors.muted }]}>{TYPES.find(({ value }) => value === type)?.effect}</Text>
          </AppCard>
        ) : null}

        {error === undefined ? null : <StatusMessage tone="danger">{error}</StatusMessage>}
        <AppButton disabled={busy} label={busy ? "Guardando…" : "Confirmar movimiento"} onPress={() => void submit()} />
        <Text style={[styles.disclaimer, { color: colors.muted }]}>El ingreso personal no incrementa este saldo. La aplicación no mueve dinero ni consulta bancos.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: "center", flexGrow: 1 },
  container: { gap: APP_SPACING.xl, maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 44, paddingHorizontal: 20, paddingTop: APP_SPACING.md, width: "100%" },
  section: { gap: APP_SPACING.sm },
  types: { gap: APP_SPACING.xs },
  type: { borderRadius: APP_RADII.medium, borderWidth: 1.5, gap: 3, minHeight: MINIMUM_TOUCH_TARGET, padding: APP_SPACING.sm },
  typeLabel: { fontSize: 15, fontWeight: "900" },
  typeEffect: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "800", marginTop: APP_SPACING.xs },
  input: { borderRadius: APP_RADII.medium, borderWidth: 1.5, fontSize: 17, minHeight: 54, paddingHorizontal: APP_SPACING.md, paddingVertical: APP_SPACING.sm },
  note: { minHeight: 92, textAlignVertical: "top" },
  preview: { gap: APP_SPACING.xs },
  previewLabel: { fontSize: 13, fontWeight: "700" },
  previewAmount: { fontSize: 29, fontWeight: "900" },
  disclaimer: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
