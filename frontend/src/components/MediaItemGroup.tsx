import React from "react";
import { Box, Button, Paper } from "@mui/material";
import { MediaPreview } from "../types";
import { API } from "../config";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";

interface MediaItemGroupProps {
  mediaItems: MediaPreview[];
  onViewAll: () => void;
}

export const MediaItemGroup: React.FC<MediaItemGroupProps> = ({
  mediaItems,
  onViewAll,
}) => {
  const previewItems = mediaItems.slice(0, 3);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}
    >
      {/* Photo Stack Preview */}
      <Box
        onClick={onViewAll}
        sx={{ position: "relative", height: "120px", cursor: "pointer" }}
      >
        {previewItems.reverse().map((media, index) => (
          <Box
            key={media.id}
            component="img"
            src={`${API}/thumbnails/${
              media.thumbnail_path || `${media.id}.jpg`
            }`}
            sx={{
              position: "absolute",
              height: "100px",
              width: "100px",
              objectFit: "cover",
              borderRadius: 1,
              boxShadow: 3,
              // Stagger the images to create a stack
              top: `${index * 8}px`,
              left: `${index * 8}px`,
              // Rotate them slightly for a more dynamic feel
              transform: `rotate(${index * 4 - 4}deg)`,
              transition: "transform 0.2s ease-in-out",
              "&:hover": {
                transform: `rotate(${index * 4 - 4}deg) scale(1.05)`,
              },
            }}
          />
        ))}
      </Box>

      {/* "View All" Button */}
      <Button
        variant="contained"
        startIcon={<PhotoLibraryIcon />}
        onClick={onViewAll}
      >
        View all {mediaItems.length} photos
      </Button>
    </Paper>
  );
};
