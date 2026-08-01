import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ImportPreview } from "../application/backup/backup-service.js";
import { useApp } from "../mobile/presentation/app-provider.js";
import { useAppColors } from "../mobile/presentation/theme.js";

export default function DataScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { busy, error, exportBackup, previewImport, confirmImport, clearError } =
    useApp();
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
      `Se importarán ${preview.goalCount} metas y ${preview.movementCount} movimientos. Antes se creará una copia automática del estado actual.`,
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
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Tus datos</Text>
      <Text style={[styles.help, { color: colors.muted }]}>
        La importación valida el formato y el checksum. El modo disponible en
        este MVP reemplaza todos los datos, nunca combina historiales.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Exportar copia completa
        </Text>
        <Text style={{ color: colors.muted }}>
          El JSON no contiene credenciales bancarias, pero sí información de
          tus metas. Guárdalo en un lugar privado.
        </Text>
        <ActionButton
          disabled={busy}
          label={busy ? "Procesando…" : "Crear y guardar copia"}
          onPress={() => void runExport()}
          primary
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Importar copia
        </Text>
        <Text style={{ color: colors.muted }}>
          Primero verás un resumen. Nada se reemplaza sin tu confirmación.
        </Text>
        <ActionButton
          disabled={busy}
          label="Seleccionar archivo JSON"
          onPress={() => void chooseImport()}
        />
      </View>

      {preview !== undefined ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Vista previa verificada
          </Text>
          <Text style={{ color: colors.text }}>
            Metas: {preview.goalCount}
          </Text>
          <Text style={{ color: colors.text }}>
            Movimientos: {preview.movementCount}
          </Text>
          <Text style={{ color: colors.text }}>
            Versión de esquema: {preview.schemaVersion}
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={2}>
            Archivo: {preview.sourceFileName}
          </Text>
          <ActionButton
            disabled={busy}
            label="Confirmar reemplazo"
            onPress={askForConfirmation}
            danger
          />
        </View>
      ) : null}

      {notice !== undefined ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>
          {notice}
        </Text>
      ) : null}
      {error !== undefined ? (
        <Pressable
          accessibilityRole="button"
          onPress={clearError}
          style={[styles.error, { borderColor: colors.danger }]}
        >
          <Text style={{ color: colors.danger }}>{error}</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.warning, { color: colors.muted }]}>
        La proyección muestra valores brutos estimados. No incluye retenciones,
        impuestos, inflación, comisiones, GMF ni cambios futuros en la tasa. El
        valor real puede ser menor.
      </Text>
    </ScrollView>
  );
}

function ActionButton({
  label,
  disabled,
  primary = false,
  danger = false,
  onPress,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly primary?: boolean;
  readonly danger?: boolean;
  readonly onPress: () => void;
}) {
  const colors = useAppColors();
  const color = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? color : "transparent",
          borderColor: color,
          opacity: disabled || pressed ? 0.65 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? colors.primaryText : color,
          fontSize: 16,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: "800" },
  help: { fontSize: 16, lineHeight: 23 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  button: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  error: { borderWidth: 1, borderRadius: 12, padding: 14 },
  warning: { fontSize: 13, lineHeight: 19, marginTop: 8 },
});
