import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Person } from "../types";
import { API } from "../config";

const getInitials = (name = "") => {
  const parts = name.split(" ");
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function PersonCard({ person }: { person: Person }) {
  const theme = useTheme();

  const thumbUrl = person.profile_face?.thumbnail_path
    ? `${API}/thumbnails/${encodeURIComponent(
        person.profile_face.thumbnail_path
      )}`
    : undefined;
  return (
    <Box
      component={RouterLink}
      to={`/person/${person.id}`}
      sx={{
        aspectRatio: "3/4",
        position: "relative",
        display: "block",
        overflow: "hidden",
        borderRadius: 3,
        textDecoration: "none",
        color: (theme) => theme.palette.common.white,
        transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
        background: thumbUrl
          ? `url("${thumbUrl}")`
          : (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        "&:hover": {
          transform: "scale(1.05)",
          boxShadow: theme.shadows[10],
          zIndex: 10,
        },
      }}
    >
      {!thumbUrl && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Typography variant="h4" fontWeight="bold">
            {getInitials(person.name || "Unknown")}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: (theme) =>
            `linear-gradient(to top, ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.8 : 0.6)} 0%, ${alpha(theme.palette.common.black, 0)} 50%)`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          p: 1.5,
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
          {person.name || "Unknown"}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: (theme) =>
              alpha(
                theme.palette.common.white,
                theme.palette.mode === "dark" ? 0.7 : 0.85
              ),
            mt: 0.5,
          }}
        >
          {person.appearance_count ? `${person.appearance_count} media` : ""}
        </Typography>
      </Box>
    </Box>
  );
}
