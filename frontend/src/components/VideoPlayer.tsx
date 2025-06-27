import { useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import ReactPlayer from "react-player";
import { Media } from "../types";
import { API } from "../config";

export function VideoWithPreview({ media }: { media: Media }) {
  const [isLoading, setIsLoading] = useState(true);
  const mediaUrl = `${API}/originals/${media.path}`;
  const scenesUrl = `${API}/api/media/${media.id}/scenes.vtt`;
  const thumbnailUrl = media.thumbnail_path
    ? `${API}/thumbnails/${media.thumbnail_path}`
    : `${API}/thumbnails/${media.id}.jpg`;

  if (!media.path) {
    return <Typography color="text.secondary">No video available</Typography>;
  }

  return (
    <Box
      sx={{
        width: "100%",
        // Use aspect-ratio for responsive, layout-shift-free sizing
        position: "relative",
        paddingTop: "56.25%" /* 16:9 Aspect Ratio */,
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      <ReactPlayer
        url={mediaUrl}
        controls
        playing // Autoplay when ready
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
        }}
        // We use these callbacks to hide our manual spinner
        onReady={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        config={{
          file: {
            attributes: { crossOrigin: "anonymous" },
          },
        }}
      />
    </Box>
  );
}
