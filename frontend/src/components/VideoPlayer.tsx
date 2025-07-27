import { useState, useEffect, useRef } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import ReactPlayer from "react-player";
import { Media } from "../types";
import { API } from "../config";

export function VideoWithPreview({ media }: { media: Media }) {
  const [isLoading, setIsLoading] = useState(false);
  const mediaUrl = `${API}/originals/${media.path}`;
  const scenesUrl = `${API}/api/media/${media.id}/scenes.vtt`;
  const thumbnailUrl = media.thumbnail_path
    ? `${API}/thumbnails/${media.thumbnail_path}`
    : `${API}/thumbnails/${media.id}.jpg`;

  const [hasAudio, setHasAudio] = useState(true); //Used to calculate timeline width offset

  const [cues, setCues] = useState([]);
  const [hoverData, setHoverData] = useState({
    visible: false,
    image: "",
    x: 0,
  });

  const playerWrapperRef = useRef(null);
  const playerRef = useRef(null);

  const PROGRESS_BAR_LEFT_OFFSET = 48;
  const PROGRESS_BAR_RIGHT_OFFSET = 225;

  useEffect(() => {
    if (!scenesUrl) return;
    fetch(scenesUrl)
      .then((res) => res.text())
      .then((text) => {
        const parsedCues = parseVTT(text);
        setCues(parsedCues);
      })
      .catch(console.error);
  }, [scenesUrl]);

  const parseVTT = (data) => {
    const pattern =
      /^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\n(.*?)$/gm;
    const toSeconds = (t) => {
      const a = t.split(":");
      return +a[0] * 3600 + +a[1] * 60 + +a[2];
    };
    let match;
    const result = [];
    while ((match = pattern.exec(data)) !== null) {
      result.push({
        start: toSeconds(match[1]),
        end: toSeconds(match[2]),
        url: match[3],
      });
    }
    return result;
  };

  const handleMouseMove = (e) => {
    const wrapper = playerWrapperRef.current;
    const player = playerRef.current;
    if (!wrapper || !player || !cues.length) return;

    const rect = wrapper.getBoundingClientRect();
    const duration = player.getDuration();
    if (!duration) return;

    const progressBarStart = PROGRESS_BAR_LEFT_OFFSET;
    let progressBarEnd = rect.width - PROGRESS_BAR_RIGHT_OFFSET;
    if (!hasAudio) {
      progressBarEnd = progressBarEnd+70;
    }
    const progressBarWidth = progressBarEnd - progressBarStart;

    const mouseX = e.clientX - rect.left;

    if (mouseX < progressBarStart || mouseX > progressBarEnd) {
      if (hoverData.visible) handleMouseLeave(); // Hide preview if visible
      return;
    }

    const progressPercent = Math.max(
      0,
      Math.min(1, (mouseX - progressBarStart) / progressBarWidth)
    );
    const hoverTime = progressPercent * duration;
    const cue = cues.find((c) => hoverTime >= c.start && hoverTime < c.end);

    if (cue) {
      // Your VTT URLs might be relative. Prepend API if necessary.
      const imageUrl = cue.url.startsWith("http")
        ? cue.url
        : `${API}${cue.url}`;
      setHoverData({
        visible: true,
        image: imageUrl,
        x: mouseX,
      });
    } else {
      // Hide if no cue found (e.g., hovering over black bars)
      if (hoverData.visible) {
        setHoverData({ ...hoverData, visible: false });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverData({ ...hoverData, visible: false });
  };

  const handleReady = () => {
    setIsLoading(false);
    const internalPlayer = playerRef.current?.getInternalPlayer();
    if (internalPlayer) {
      setHasAudio(internalPlayer.mozHasAudio);
    }
  };

  if (!media.path) {
    return <Typography color="text.secondary">No video available</Typography>;
  }

  return (
    <Box
      ref={playerWrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        width: "100%",
        position: "relative",
        paddingTop: "56.25%",
        backgroundColor: "#000",
        cursor: "pointer", // Indicate interactivity
      }}
    >
      {/* Loading spinner */}
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
        ref={playerRef}
        url={mediaUrl}
        controls
        playing
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }} // Disable pointer events on the player itself
        light={thumbnailUrl}
        onReady={handleReady}
        onError={() => setIsLoading(false)}
        // The config track is not needed for the manual implementation
      />

      {/* 3. Display the thumbnail preview */}
      {hoverData.visible && (
        <Box
          sx={{
            position: "absolute",
            bottom: "80px", // Adjust this based on your control bar height
            left: hoverData.x,
            transform: "translateX(-50%)",
            bgcolor: "#000",
            border: "1px solid #fff",
            p: "2px",
            zIndex: 2, // Ensure it's on top
            pointerEvents: "none", // Prevent the preview from capturing mouse events
          }}
        >
          <img
            src={hoverData.image}
            alt="preview"
            style={{ width: 160, display: "block" }}
          />
        </Box>
      )}
    </Box>
  );
}
