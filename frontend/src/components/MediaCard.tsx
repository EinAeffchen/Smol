import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  CardActionArea,
  CardMedia,
  Box,
  Typography,
  useTheme,
} from "@mui/material";
import { Media } from "../types";
import { API } from "../config";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { Person } from "../types";

function formatDuration(d?: number): string {
  if (d == null) return "";
  const m = Math.floor(d / 60);
  const s = Math.round(d % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

interface MediaCardProps {
  media: Media;
  sortOrder?: "newest" | "latest";
  filterPeople?: Person[];
}

export default function MediaCard({
  media,
  sortOrder = "newest",
  filterPeople,
}: MediaCardProps) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isVideo = typeof media.duration === "number";
  const mediaUrl = `${API}/originals/${media.path}`;
  let thumbUrl;
  if (media.thumbnail_path) {
    thumbUrl = `${API}/thumbnails/${media.thumbnail_path}`;
  } else {
    thumbUrl = `${API}/thumbnails/${media.id}.jpg`;
  }
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    const isAlreadyInModal = !!location.state?.backgroundLocation;

    navigate(`/medium/${media.id}`, {
      replace: isAlreadyInModal,
      state: {
        backgroundLocation: isAlreadyInModal
          ? location.state.backgroundLocation
          : location,
        viewContext: { sort: sortOrder, filterPeople: filterPeople },
        media: media,
      },
    });
  };

  const handleMouseEnter = () => {
    setHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.error("Video play failed:", err);
      });
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Rewind video
    }
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
      <CardActionArea
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          // Use a pseudo-element for aspect ratio to prevent layout shift
          position: "relative",
          display: "block",
          width: "100%",
          paddingTop: "100%", // For 1:1 aspect ratio. Use '56.25%' for 16:9
        }}
      >
        {/* Container for media elements that will fill the parent */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {/* Thumbnail Image - Controls opacity */}
          <CardMedia
            component="img"
            src={thumbUrl}
            alt={media.filename}
            sx={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: hovered && isVideo ? 0 : 1,
              transition: "opacity 0.3s ease-in-out",
            }}
          />

          {/* Video Player - Controls opacity */}
          {isVideo && (
            <CardMedia
              ref={videoRef}
              component="video"
              src={mediaUrl}
              muted
              loop
              playsInline
              sx={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: hovered ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
              }}
            />
          )}
        </Box>

        {isVideo && (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              pointerEvents: "none",
              transition: "opacity 0.3s ease-in-out",
              opacity: hovered ? 0 : 0.8, // Hide on hover
            }}
          >
            <PlayArrowIcon sx={{ fontSize: "3rem" }} />
          </Box>
        )}

        {/* Gradient and Info overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)",
            opacity: hovered ? 1 : 0, // Fade the whole overlay in on hover
            transition: "opacity 0.3s ease-in-out",
            pointerEvents: "none", // Allow clicks to pass through to the CardActionArea
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1.5,
                color: "white",
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
        </Box>
      </CardActionArea>
    </Card>
  );
}
