import React from "react";
import { Box, Typography, Button } from "@mui/material";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      py={8}
      px={2}
      sx={{
        opacity: 0.8,
        animation: "fadeIn 0.5s ease-in-out",
        "@keyframes fadeIn": {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 0.8, transform: "translateY(0)" },
        },
      }}
    >
      {icon && (
        <Box
          sx={{
            fontSize: 64,
            color: "text.secondary",
            mb: 2,
            opacity: 0.5,
            "& svg": { fontSize: "inherit" },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography variant="h6" color="text.primary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: 3 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="outlined" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
}
