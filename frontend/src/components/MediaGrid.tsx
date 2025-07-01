import React from "react";
import { Box } from "@mui/material";
import { MediaPreview } from "../types";
import MediaCard from "./MediaCard";

interface MediaGridProps {
  mediaItems: MediaPreview[];
  listKey: string;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  mediaItems,
  listKey,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2, // Sets the spacing between cards
      }}
    >
      {mediaItems.map((media) => (
        <Box
          key={media.id}
          sx={{
            flex: "1 1 200px",
            maxWidth: "220px",
          }}
        >
          <MediaCard media={media} mediaListKey={listKey} />
        </Box>
      ))}
    </Box>
  );
};
