import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import App from './App';

import { AppThemeProvider, useThemeContext } from './ThemeContext'; // Import your new context provider
import { getTheme } from './theme';

import './index.css';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';


delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

function ThemedRoot() {
  const { mode } = useThemeContext();
  // We call getTheme() with the current mode to create a dynamic theme object.
  // useMemo ensures this only runs when the mode changes.
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </MuiThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 1. The AppThemeProvider manages the 'light'/'dark' state */}
    <AppThemeProvider>
      {/* 2. ThemedRoot consumes that state to provide the correct theme to MUI */}
      <ThemedRoot />
    </AppThemeProvider>
  </React.StrictMode>
);