import React, { useEffect, useState, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { Media } from "../types";
import MediaCard from "./MediaCard";
import { getSimilarMedia } from "../services/media";

export default function SimilarContent({ mediaId }: { mediaId: number }) {
  const [similar, setSimilar] = useState<Media[]>([]);
  const similarIds = useMemo(() => similar.map((item) => item.id), [similar]);

  useEffect(() => {
    if (!mediaId) return;
    const controller = new AbortController();

    getSimilarMedia(mediaId)
      .then(setSimilar)
      .catch((err) => {
        // When the fetch is aborted, it throws an error. We can safely ignore it.
        if (err.name !== "AbortError") {
          console.error(err);
        }
      });
    return () => {
      controller.abort();
    };
  }, [mediaId]);

  if (similar.length === 0) return null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Similar Content
      </Typography>

      <Box
        sx={{
          columnCount: { xs: 2, sm: 2, md: 3 },
          columnGap: (theme) => theme.spacing(2),
        }}
      >
        {similar.map((item) => (
          <Box
            key={item.id}
            sx={{
              breakInside: "avoid",
              mb: 2,
            }}
          >
            <MediaCard media={item} navigationContext={{ ids: similarIds }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
