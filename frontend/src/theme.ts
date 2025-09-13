import { createTheme } from "@mui/material";

// Gallery Slate palette and derived tints
const gallerySlate = {
  light: {
    primary: { main: "#4B75FF", light: "#7EA1FF", dark: "#2E4FDB" },
    secondary: { main: "#7B8DA5", light: "#A7B4C6", dark: "#536072" },
    accent: { main: "#00C2A8", light: "#3AD9C2", dark: "#009782" },
    background: { default: "#F7F8FA", paper: "#FFFFFF" },
    text: { primary: "#0F1115", secondary: "#4A5568", disabled: "#A3AAB5" },
    divider: "#E6E8ED",
    success: { main: "#2EBD85" },
    warning: { main: "#F4B740" },
    error: { main: "#E5484D" },
    info: { main: "#3AA6FF" },
    overlays: {
      elevated: "#FFFFFF",
      hover: "rgba(15,17,21,0.05)",
      active: "rgba(15,17,21,0.10)",
      focus: "rgba(75,117,255,0.35)",
      selection: "rgba(75,117,255,0.28)",
    },
  },
  dark: {
    primary: { main: "#7EA1FF", light: "#AECBFF", dark: "#5169E2" },
    secondary: { main: "#9BA5B1", light: "#C4CBD3", dark: "#6C7480" },
    accent: { main: "#15E6C1", light: "#5AF1D6", dark: "#0FA88F" },
    background: { default: "#0F1115", paper: "#161A22" },
    text: { primary: "#E6E8ED", secondary: "#A9B1BA", disabled: "#6C7480" },
    divider: "#2A2F3A",
    success: { main: "#36D39A" },
    warning: { main: "#F6C350" },
    error: { main: "#F26A6F" },
    info: { main: "#63B5FF" },
    overlays: {
      elevated: "#1C212C",
      hover: "rgba(230,232,237,0.06)",
      active: "rgba(230,232,237,0.12)",
      focus: "rgba(126,161,255,0.32)",
      selection: "rgba(126,161,255,0.28)",
    },
  },
} as const;

export const getTheme = (mode: ThemeMode) => {
  const p = mode === "light" ? gallerySlate.light : gallerySlate.dark;
  const theme = createTheme({
    palette: {
      mode,
      primary: p.primary,
      secondary: p.secondary,
      background: p.background,
      text: p.text as any,
      divider: p.divider as any,
      success: p.success as any,
      warning: p.warning as any,
      error: p.error as any,
      info: p.info as any,
      // custom field set via module augmentation below
      accent: p.accent as any,
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: (themeParam) => ({
          'html, body, #root': {
            backgroundColor: themeParam.palette.background.default,
            color: themeParam.palette.text.primary,
            minHeight: '100%'
          },
          body: {
            // CSS custom properties for app-wide use
            "--color-bg": themeParam.palette.background.default,
            "--color-paper": themeParam.palette.background.paper,
            "--color-text": themeParam.palette.text.primary as any,
            "--color-text-secondary": (themeParam.palette.text as any).secondary,
            "--color-divider": themeParam.palette.divider as any,
            "--color-primary": themeParam.palette.primary.main,
            "--color-secondary": themeParam.palette.secondary.main,
            "--color-accent": (themeParam.palette as any).accent.main,
            "--overlay-hover": (p as any).overlays.hover,
            "--overlay-active": (p as any).overlays.active,
            "--overlay-focus": (p as any).overlays.focus,
            "--overlay-selection": (p as any).overlays.selection,
          },
          '.MuiPaper-root': {
            backgroundColor: themeParam.palette.background.paper,
            color: themeParam.palette.text.primary,
          },
          '.MuiDialog-paper': {
            backgroundColor: themeParam.palette.background.paper,
            color: themeParam.palette.text.primary,
          },
        }),
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            '&.MuiPaper-elevation1': { backgroundColor: (p as any).overlays.elevated },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          colorPrimary: {
            backgroundColor: p.background.paper,
            color: p.text.primary,
            borderBottom: `1px solid ${p.divider}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none" },
          containedPrimary: { boxShadow: "none" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8 },
          colorPrimary: ({ theme }) => ({
            background: theme.palette.secondary.main,
            color: theme.palette.getContrastText(theme.palette.secondary.main),
          }),
          colorInfo: ({ theme }) => ({
            background: theme.palette.info.main,
            color: (theme.vars || theme).palette?.common?.black || "#0F1115",
          }),
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: p.accent.main },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: "none" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: p.background.paper,
            color: p.text.primary,
            border: `1px solid ${p.divider}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            "&:hover": { background: p.overlays.hover },
            "&.Mui-selected": {
              background: p.overlays.selection,
              outline: `1px solid ${p.primary.main}`,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            "&:hover": { background: p.overlays.hover },
            "&.Mui-focusVisible": { boxShadow: `0 0 0 3px ${p.overlays.focus}` },
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: p.divider } },
      },
    },
  });
  return theme;
};

// Palette augmentation for custom 'accent'
declare module "@mui/material/styles" {
  interface Palette {
    accent: Palette["primary"];
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"];
  }
}
