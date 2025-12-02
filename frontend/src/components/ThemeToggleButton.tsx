import React from "react";
import { Box, Switch, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useThemeContext } from "../ThemeContext"; // Make sure the path is correct

const ThemeSwitch = styled(Switch)(({ theme }) => ({
  width: 58,
  height: 34,
  padding: 0,
  display: "flex",
  "& .MuiSwitch-switchBase": {
    padding: 4,
    transitionDuration: "180ms",
    "&.Mui-checked": {
      transform: "translateX(24px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor:
          theme.palette.mode === "dark"
            ? theme.palette.primary.main
            : theme.palette.secondary.main,
        opacity: 1,
      },
    },
  },
  "& .MuiSwitch-thumb": {
    boxShadow: "none",
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  "& .MuiSwitch-track": {
    borderRadius: 17,
    opacity: 1,
    backgroundColor:
      theme.palette.mode === "light"
        ? theme.palette.grey[400]
        : theme.palette.grey[700],
  },
}));

export default function ThemeToggleButton() {
  const { mode, toggleTheme } = useThemeContext();

  return (
    <Tooltip
      title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      arrow
    >
      <Box
        display="flex"
        alignItems="center"
        gap={1}
        sx={{ color: "text.secondary" }}
      >
        <LightModeIcon
          fontSize="small"
          color={mode === "light" ? "warning" : "disabled"}
        />
        <ThemeSwitch
          checked={mode === "dark"}
          onChange={() => toggleTheme()}
          inputProps={{ "aria-label": "Toggle light or dark theme" }}
        />
        <DarkModeIcon
          fontSize="small"
          color={mode === "dark" ? "primary" : "disabled"}
        />
      </Box>
    </Tooltip>
  );
}
