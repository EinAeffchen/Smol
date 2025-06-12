import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#5F4B8B", // Deep Violet
    },
    secondary: {
      main: "#FF2E88", // Electric Pink
    },
    background: {
      default: "#1C1C1E",
      paper: "#2C2C2E",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#BFA2DB",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "Inter, sans-serif",
  },
});
