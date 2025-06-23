import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from "@mui/material";
import { ThemeContext } from "@emotion/react";

export const getTheme = (mode: ThemeMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "light"
        ? {
            // Light Mode Palette
            primary: { main: "#3f51b5" },
            background: { default: "#f5f5f5", paper: "#ffffff" },
            text: { primary: "#212121" },
            accent: { main: "#ff4081" },
          }
        : {
            // Dark Mode Palette
            primary: { main: "#90caf9" },
            background: { default: "#212025", paper: "#2c2b30" },
            text: { primary: "#F8F8F8" },
            accent: { main: "#FF007F" },
          }),
    },
    // This component setting applies the CSS variables to the root element
    components: {
      MuiCssBaseline: {
        styleOverrides: (theme) => ({
          body: {
            // --tw-bg-background is the CSS variable for Tailwind's `bg-background`
            "--tw-bg-background": theme.palette.background.default,
            "--tw-text-text": theme.palette.text.primary,
            "--tw-color-accent": theme.palette.accent.main,
            // Add other variables as needed
          },
        }),
      },
    },
  });

// Define a new type for the custom 'accent' color
declare module "@mui/material/styles" {
  interface Palette {
    accent: Palette["primary"];
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"];
  }
}
