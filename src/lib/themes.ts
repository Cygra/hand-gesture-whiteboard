import type { ThemeMode } from "./types";

export const THEME_PALETTES: Record<
  ThemeMode,
  {
    appBg: string;
    text: string;
    sceneBackground: string;
    fog: string;
    floor: string;
    tank: string;
    particle: string;
    modalBg: string;
    modalText: string;
  }
> = {
  light: {
    appBg: "#f4fbff",
    text: "#16334d",
    sceneBackground: "#edf7ff",
    fog: "#f5fbff",
    floor: "#d9ebfb",
    tank: "#6ba7d8",
    particle: "#8bb8db",
    modalBg: "#f8fcff",
    modalText: "#17324a",
  },
  dark: {
    appBg: "#0a1016",
    text: "#d7e8f9",
    sceneBackground: "#0c141f",
    fog: "#122031",
    floor: "#1b2a3c",
    tank: "#5f8cb7",
    particle: "#7ea3c5",
    modalBg: "#101b28",
    modalText: "#d3e6fb",
  },
};
