import { readFile } from "node:fs/promises";

import { utf8ByteLength } from "../src/index.js";

interface AppConfiguration {
  readonly expo?: {
    readonly android?: {
      readonly allowBackup?: boolean;
      readonly blockedPermissions?: readonly string[];
    };
  };
}

describe("configuración de seguridad móvil", () => {
  it("excluye respaldos automáticos y permisos de almacenamiento heredados", async () => {
    const configuration = JSON.parse(
      await readFile(new URL("../app.json", import.meta.url), "utf8"),
    ) as AppConfiguration;
    expect(configuration.expo?.android?.allowBackup).toBe(false);
    expect(configuration.expo?.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.VIBRATE",
      ]),
    );
  });

  it("mide UTF-8 sin perder equivalencia para caracteres multibyte", () => {
    expect(utf8ByteLength("Ahorro ñ 💰")).toBe(
      new TextEncoder().encode("Ahorro ñ 💰").byteLength,
    );
  });
});
