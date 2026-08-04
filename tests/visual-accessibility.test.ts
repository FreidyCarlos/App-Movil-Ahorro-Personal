import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  DARK_COLORS,
  LIGHT_COLORS,
  MAX_CONTENT_WIDTH,
  MINIMUM_TOUCH_TARGET,
  contrastRatio,
  type AppColors,
} from "../src/mobile/presentation/visual-system.js";

const NORMAL_TEXT_CONTRAST = 4.5;

function expectReadablePalette(colors: AppColors) {
  const pairs = [
    [colors.text, colors.background],
    [colors.muted, colors.background],
    [colors.text, colors.surface],
    [colors.primaryText, colors.primary],
    [colors.accentText, colors.accent],
    [colors.primary, colors.primarySoft],
    [colors.accent, colors.accentSoft],
    [colors.success, colors.successSoft],
    [colors.danger, colors.dangerSoft],
  ] as const;

  for (const [foreground, background] of pairs) {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
      NORMAL_TEXT_CONTRAST,
    );
  }
}

describe("sistema visual accesible", () => {
  it("mantiene contraste AA para texto normal en ambos temas", () => {
    expectReadablePalette(LIGHT_COLORS);
    expectReadablePalette(DARK_COLORS);
  });

  it("define objetivos táctiles y ancho de lectura adecuados", () => {
    expect(MINIMUM_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
    expect(MAX_CONTENT_WIDTH).toBeGreaterThanOrEqual(320);
    expect(MAX_CONTENT_WIDTH).toBeLessThanOrEqual(720);
  });

  it("rechaza colores mal formados al comprobar contraste", () => {
    expect(() => contrastRatio("verde", LIGHT_COLORS.background)).toThrow(
      "hexadecimal",
    );
  });

  it("conserva tema automático, orientación admitida y movimiento reducido", async () => {
    const appConfig = JSON.parse(
      await readFile(new URL("../app.json", import.meta.url), "utf8"),
    ) as { expo: { orientation: string; userInterfaceStyle: string } };
    const layout = await readFile(
      new URL("../src/app/_layout.tsx", import.meta.url),
      "utf8",
    );

    expect(appConfig.expo.orientation).toBe("portrait");
    expect(appConfig.expo.userInterfaceStyle).toBe("automatic");
    expect(layout).toContain("isReduceMotionEnabled");
    expect(layout).toContain('"reduceMotionChanged"');
  });

  it("no trunca textos en las pantallas informativas", async () => {
    const sources = await Promise.all(
      [
        "index.tsx",
        "new-goal.tsx",
        "data.tsx",
        "goal/[id].tsx",
        "goal/[id]/register.tsx",
      ].map((name) =>
        readFile(new URL(`../src/app/${name}`, import.meta.url), "utf8"),
      ),
    );
    const sharedUi = await readFile(
      new URL("../src/mobile/presentation/ui.tsx", import.meta.url),
      "utf8",
    );

    for (const source of sources) {
      expect(source).not.toContain("numberOfLines=");
      expect(source).toContain("PageIntro");
    }
    expect(sharedUi).toContain('accessibilityRole="header"');
  });

  it("expone foco, estados y controles semánticos", async () => {
    const sharedUi = await readFile(
      new URL("../src/mobile/presentation/ui.tsx", import.meta.url),
      "utf8",
    );
    const goalForm = await readFile(
      new URL("../src/app/new-goal.tsx", import.meta.url),
      "utf8",
    );
    const dataScreen = await readFile(
      new URL("../src/app/data.tsx", import.meta.url),
      "utf8",
    );
    const detailScreen = await readFile(
      new URL("../src/app/goal/[id].tsx", import.meta.url),
      "utf8",
    );
    const movementScreen = await readFile(
      new URL("../src/app/goal/[id]/register.tsx", import.meta.url),
      "utf8",
    );

    expect(sharedUi).toContain("onFocus");
    expect(sharedUi).toContain("accessibilityState={{ disabled }}");
    expect(sharedUi).toContain('accessibilityLiveRegion="polite"');
    expect(goalForm).toContain('accessibilityRole="radiogroup"');
    expect(goalForm).toContain('accessibilityRole="radio"');
    expect(goalForm).toContain("measureInWindow");
    expect(goalForm).toContain("keyboardVerticalOffset");
    expect(dataScreen).toContain("Alert.alert");
    expect(dataScreen).toContain('variant="danger"');
    expect(detailScreen).toContain('accessibilityLabel="Motivo de la revisión"');
    expect(detailScreen).toContain('accessibilityLabel="Motivo de la anulación"');
    expect(movementScreen).toContain('accessibilityRole="radiogroup"');
    expect(movementScreen).toContain('accessibilityRole="radio"');
  });
});
