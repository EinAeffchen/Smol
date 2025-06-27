import React, { useMemo } from "react";
import {
  BrowserRouter as Router,
} from "react-router-dom";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { useThemeContext } from "./ThemeContext";
import { getTheme } from "./theme";
import { AppRoutes } from "./routes";

export default function App() {
  const { mode } = useThemeContext();
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppRoutes />
      </Router>
    </MuiThemeProvider>
  );
}
