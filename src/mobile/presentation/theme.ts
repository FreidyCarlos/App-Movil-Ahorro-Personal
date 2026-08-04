import { useColorScheme } from "react-native";

import {
  DARK_COLORS,
  LIGHT_COLORS,
  type AppColors,
} from "./visual-system.js";

export type { AppColors } from "./visual-system.js";

export function useAppColors(): AppColors {
  return useColorScheme() === "dark" ? DARK_COLORS : LIGHT_COLORS;
}
