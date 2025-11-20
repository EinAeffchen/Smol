import React from "react";
import { Box, Skeleton, Card, CardContent } from "@mui/material";

export function MediaSkeleton() {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: 1,
      }}
    >
      <Box sx={{ position: "relative", paddingTop: "75%" }}>
        <Skeleton
          variant="rectangular"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </Box>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Skeleton variant="text" width="40%" height={20} />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
      </CardContent>
    </Card>
  );
}
