import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { MediaPreview } from "../types";
import MediaCard from "./MediaCard";
import { API } from "../config";

export default function SimilarContent({ mediaId }: { mediaId: number }) {
  const [similar, setSimilar] = useState<MediaPreview[]>([]);

  useEffect(() => {
    if (!mediaId) return;
    fetch(`${API}/api/media/${mediaId}/get_similar`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load similar media");
        return res.json() as Promise<MediaPreview[]>;
      })
      .then(setSimilar)
      .catch(console.error);
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
            <MediaCard media={item} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
