import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ImportPreview } from "../application/backup/backup-service.js";
import { useApp } from "../mobile/presentation/app-provider.js";
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
  APP_RADII,
  APP_SPACING,
  MAX_CONTENT_WIDTH,
} from "../mobile/presentation/visual-system.js";

export default function DataScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { busy, error, exportBackup, previewImport, confirmImport, clearError } = useApp();
  const [preview, setPreview] = useState<ImportPreview>();
  const [notice, setNotice] = useState<string>();

  const runExport = async () => {
    setNotice(undefined);
    try {
      const result = await exportBackup();
      setNotice(
        result.shared
          ? "La copia se creó y se abrió el selector para guardarla."
          : `La copia ${result.name} quedó guardada dentro de la aplicación.`,
      );
    } catch {
      // El proveedor presenta un mensaje seguro.
    }
  };

  const chooseImport = async () => {
    setNotice(undefined);
    setPreview(undefined);
    try {
      const selected = await previewImport();
      if (selected !== undefined) {
        setPreview(selected);
      }
    } catch {
      // El proveedor presenta un mensaje seguro.
    }
  };

  const askForConfirmation = () => {
    if (preview === undefined) {
      return;
    }
    Alert.alert(
      "Reemplazar datos locales",
      `Se importarán ${preview.goalCount} metas y ${preview.movementCount} movimientos. Antes se creará una copia automática del estado actual. Esta acción no combina historiales.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reemplazar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await confirmImport(preview.confirmationToken);
                setPreview(undefined);
                setNotice("La copia se importó y verificó correctamente.");
                router.setParams({});
              } catch {
                // El proveedor presenta un mensaje seguro.
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.scrollContent}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.container}>
        <PageIntro
          description="Exporta para conservar una copia o importa para reemplazar el estado local después de revisarlo."
          eyebrow="Continuidad local"
          title="Tus datos también necesitan una ruta de regreso."
        />

        <AppCard style={styles.safetyStrip} tone="primary">
          <View style={styles.tagRow}>
            <Tag>JSON VERSIONADO</Tag>
            <Tag>CHECKSUM</Tag>
            <Tag accent>SIN CIFRADO</Tag>
          </View>
          <Text style={[styles.safetyText, { color: colors.muted }]}>El checksum ayuda a detectar daño accidental; no demuestra quién creó el archivo ni lo mantiene secreto.</Text>
        </AppCard>

        {notice === undefined ? null : <StatusMessage tone="success">{notice}</StatusMessage>}
        {error === undefined ? null : <StatusMessage onDismiss={clearError} tone="danger">{error}</StatusMessage>}

        <View style={styles.section}>
          <SectionHeading
            description="Una salida segura antes de cambiar de equipo o hacer pruebas."
            number="01"
            title="Crear una copia"
          />
          <AppCard style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={[styles.actionSymbol, { backgroundColor: colors.accentSoft }]}>
                <Text accessibilityElementsHidden style={[styles.actionSymbolText, { color: colors.accent }]}>01</Text>
              </View>
              <View style={styles.actionTitleBlock}>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>Exportar todo</Text>
                <Text style={[styles.cardKicker, { color: colors.accent }]}>COPIA PORTABLE</Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: colors.muted }]}>Incluye tus metas y configuraciones. Puede contener información financiera personal: elige un destino privado.</Text>
            <AppButton
              accessibilityHint="Crea una copia JSON y abre las opciones disponibles para guardarla"
              disabled={busy}
              label={busy ? "Procesando…" : "Crear y guardar copia"}
              onPress={() => void runExport()}
            />
          </AppCard>
        </View>

        <View style={styles.section}>
          <SectionHeading
            description="Primero se inspecciona el archivo. Nada cambia al seleccionarlo."
            number="02"
            title="Revisar una copia"
          />
          <AppCard style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <View style={[styles.actionSymbol, { backgroundColor: colors.primarySoft }]}>
                <Text accessibilityElementsHidden style={[styles.actionSymbolText, { color: colors.primary }]}>02</Text>
              </View>
              <View style={styles.actionTitleBlock}>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>Seleccionar e inspeccionar</Text>
                <Text style={[styles.cardKicker, { color: colors.primary }]}>SIN REEMPLAZAR</Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: colors.muted }]}>Validamos tamaño, formato, versión, estructura y checksum antes de mostrar el resumen.</Text>
            <AppButton
              accessibilityHint="Abre el selector de archivos JSON"
              disabled={busy}
              label="Elegir archivo JSON"
              onPress={() => void chooseImport()}
              variant="secondary"
            />
          </AppCard>
        </View>

        {preview === undefined ? null : (
          <View style={styles.section}>
            <SectionHeading
              description="Este resumen ya superó la validación inicial. Comprueba las cantidades antes de continuar."
              number="03"
              title="Decidir el reemplazo"
            />
            <AppCard style={styles.previewCard} tone="accent">
              <View style={styles.previewHeader}>
                <Tag accent>ARCHIVO VERIFICADO</Tag>
                <View style={[styles.verifiedDot, { backgroundColor: colors.success }]} />
              </View>
              <View
                accessibilityLabel={`Copia verificada con ${preview.goalCount} metas, ${preview.movementCount} movimientos y esquema ${preview.schemaVersion}`}
                accessible
                style={styles.metrics}
              >
                <Metric label="Metas" value={String(preview.goalCount)} />
                <Metric label="Movimientos" value={String(preview.movementCount)} />
                <Metric label="Esquema" value={`v${preview.schemaVersion}`} />
              </View>
              <View style={[styles.fileName, { backgroundColor: colors.background }]}>
                <Text style={[styles.fileLabel, { color: colors.muted }]}>Archivo seleccionado</Text>
                <Text style={[styles.fileValue, { color: colors.text }]}>{preview.sourceFileName}</Text>
              </View>
              <StatusMessage tone="danger">Reemplazará todos los datos locales. Antes se crea una copia automática para recuperación.</StatusMessage>
              <AppButton
                accessibilityHint="Abre la confirmación final antes de reemplazar los datos"
                disabled={busy}
                label="Revisé el resumen: continuar"
                onPress={askForConfirmation}
                variant="danger"
              />
            </AppCard>
          </View>
        )}

        <AppCard style={styles.privacyCard}>
          <Text accessibilityRole="header" style={[styles.privacyTitle, { color: colors.text }]}>Privacidad sin letra pequeña</Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>La base local y los JSON del MVP no están cifrados. La aplicación no guarda credenciales bancarias, pero una copia expuesta puede revelar tus metas.</Text>
        </AppCard>

        <Text style={[styles.warning, { color: colors.muted }]}>La proyección muestra valores brutos estimados. No incluye retenciones, impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El valor real puede ser menor.</Text>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  const colors = useAppColors();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { alignItems: "center", flexGrow: 1 },
  container: { gap: APP_SPACING.xl, maxWidth: MAX_CONTENT_WIDTH, paddingBottom: 44, paddingHorizontal: 20, paddingTop: APP_SPACING.md, width: "100%" },
  safetyStrip: { gap: APP_SPACING.sm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs },
  safetyText: { fontSize: 13, lineHeight: 19 },
  section: { gap: APP_SPACING.md },
  actionCard: { gap: APP_SPACING.md },
  actionHeader: { alignItems: "center", flexDirection: "row", gap: APP_SPACING.sm },
  actionSymbol: { alignItems: "center", borderRadius: APP_RADII.medium, height: 48, justifyContent: "center", width: 48 },
  actionSymbolText: { fontSize: 25, fontWeight: "800" },
  actionTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 19, fontWeight: "800", lineHeight: 25 },
  cardKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  cardBody: { fontSize: 14, lineHeight: 21 },
  previewCard: { gap: APP_SPACING.md },
  previewHeader: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.xs, justifyContent: "space-between" },
  verifiedDot: { borderRadius: 6, height: 12, width: 12 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: APP_SPACING.sm },
  metric: { flexGrow: 1, minWidth: 86 },
  metricValue: { fontSize: 25, fontWeight: "900" },
  metricLabel: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  fileName: { borderRadius: APP_RADII.small, gap: 4, padding: APP_SPACING.sm },
  fileLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  fileValue: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  privacyCard: { gap: APP_SPACING.xs },
  privacyTitle: { fontSize: 18, fontWeight: "800" },
  warning: { fontSize: 12, lineHeight: 18, paddingHorizontal: APP_SPACING.xs },
});
