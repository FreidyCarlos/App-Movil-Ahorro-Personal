import { useColorScheme } from "react-native";

export interface AppColors {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly primary: string;
  readonly primaryText: string;
  readonly border: string;
  readonly danger: string;
  readonly success: string;
}

const light: AppColors = {
  background: "#F4F7F5",
  surface: "#FFFFFF",
  text: "#15231B",
  muted: "#526158",
  primary: "#176B45",
  primaryText: "#FFFFFF",
  border: "#CBD8D0",
  danger: "#A12A2A",
  success: "#176B45",
};

const dark: AppColors = {
  background: "#0F1712",
  surface: "#18231C",
  text: "#F0F6F2",
  muted: "#B4C2B9",
  primary: "#69D49C",
  primaryText: "#0B2818",
  border: "#35463B",
  danger: "#FF9B9B",
  success: "#69D49C",
};

export function useAppColors(): AppColors {
  return useColorScheme() === "dark" ? dark : light;
}
