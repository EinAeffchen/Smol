import React, { useState, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import ReactPlayer from "react-player";
import {
  Card,
  CardActionArea,
  CardMedia,
  Box,
  Typography,
  useTheme,
} from "@mui/material";
import { MediaPreview } from "../types";
import { API } from "../config";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";

function formatDuration(d?: number): string {
  if (d == null) return "";
  const m = Math.floor(d / 60);
  const s = Math.round(d % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

interface MediaCardProps {
  media: MediaPreview;
  mediaListKey?: string;
}

export default function MediaCard({ media, mediaListKey }: MediaCardProps) {
  const theme = useTheme();
  // This state now explicitly controls when the video player is active.
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const location = useLocation();

  const isVideo = typeof media.duration === "number";

  const mediaUrl = `${API}/originals/${media.path}`;
  const thumbUrl = media.thumbnail_path
    ? `${API}/thumbnails/${media.thumbnail_path}`
    : `${API}/thumbnails/${media.id}.jpg`;

  const linkState = {
    backgroundLocation: location.state?.backgroundLocation || location,
    mediaListKey: mediaListKey,
    media: media,
  };

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsPlayerActive(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsPlayerActive(false);
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
        transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
        "&:hover": {
          transform: "scale(1.02)",
          boxShadow: theme.shadows[10],
          zIndex: 10,
        },
      }}
    >
      <Link
        to={`/medium/${media.id}`}
        state={linkState}
        replace={!!location.state?.backgroundLocation}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <CardActionArea
          onMouseEnter={isVideo ? handleMouseEnter : undefined}
          onMouseLeave={isVideo ? handleMouseLeave : undefined}
          sx={{
            position: "relative",
            display: "block",
            width: "100%",
            paddingTop: "100%",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {/* We now explicitly render the thumbnail image for videos */}
            <CardMedia
              component="img"
              src={thumbUrl}
              alt={media.filename}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                // The thumbnail is visible when the player is NOT active
                opacity: isPlayerActive ? 0 : 1,
                transition: "opacity 0.3s ease-in-out",
              }}
            />

            {/* The player is always in the DOM for videos, but only receives its URL and plays when active */}
            {isVideo && (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  // The player is visible ONLY when it's active
                  opacity: isPlayerActive ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out",
                  // Keep pointer events to allow ReactPlayer to be interactive
                }}
              >
                <ReactPlayer
                  url={isPlayerActive ? mediaUrl : undefined}
                  playing={isPlayerActive}
                  loop
                  muted
                  width="100%"
                  height="100%"
                  playsinline
                  config={{
                    file: { attributes: { crossOrigin: "anonymous" } },
                  }}
                  style={{ position: "absolute", top: 0, left: 0 }}
                />
              </Box>
            )}
          </Box>

          {/* Overlays */}
          {isVideo && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                transition: "opacity 0.3s ease-in-out",
                opacity: isPlayerActive ? 0 : 0.8, // Hide play icon when player is active
                pointerEvents: "none",
              }}
            >
              <PlayArrowIcon sx={{ fontSize: "3rem", color: "white" }} />
            </Box>
          )}

          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              p: 1.5,
              color: "white",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)",
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {isVideo ? (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PlayCircleOutlineIcon sx={{ fontSize: "1rem" }} />
                  <Typography variant="caption" lineHeight={1}>
                    {formatDuration(media.duration)}
                  </Typography>
                </Box>
              ) : (
                <div />
              )}
              <Typography variant="caption" lineHeight={1}>
                {media.width && media.height
                  ? `${media.width}×${media.height}`
                  : ""}
              </Typography>
            </Box>
          </Box>
        </CardActionArea>
      </Link>
    </Card>
  );
}
