import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Snackbar,
  LinearProgress,
  Alert,
  IconButton,
  useTheme,
  useMediaQuery,
  Fade,
} from "@mui/material";
import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";
import { ActionDialogs } from "../components/ActionDialogs";
import { MediaDisplay } from "../components/MediaDisplay";
import { MediaHeader } from "../components/MediaHeader";
import { Media, MediaDetail, Task } from "../types";
import { API } from "../config";
import { MediaContentTabs } from "../components/MediaContentTabs";

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [dialogType, setDialogType] = useState<
    "convert" | "deleteRecord" | "deleteFile" | null
  >(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [tabValue, setTabValue] = useState(0);

  const [neighbors, setNeighbors] = useState<{
    previousId: string | null;
    nextId: string | null;
  }>({ previousId: null, nextId: null });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const viewContext = useMemo(
    () => location.state?.viewContext || { sort: "newest" },
    [location.state]
  );
  const queryParams = new URLSearchParams(viewContext).toString();

  // Load media detail
  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/api/media/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Failed to load media",
        severity: "error",
      });
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/media/${id}/neighbors?${queryParams}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setNeighbors({ previousId: data.previous_id, nextId: data.next_id });
        }
      })
      .catch((err) => console.error("Failed to fetch neighbors:", err));
  }, [id, viewContext]);

  useEffect(() => {
    setDetail(null);
    setTabValue(0);
    loadDetail();
  }, [id, loadDetail]);
  useEffect(() => {
    if (isMobile && (neighbors.nextId || neighbors.previousId)) {
      const hintShown = sessionStorage.getItem("swipeHintShown");
      if (!hintShown) {
        setShowSwipeHint(true);
        sessionStorage.setItem("swipeHintShown", "true");
        const timer = setTimeout(() => {
          setShowSwipeHint(false);
        }, 3500);
        return () => clearTimeout(timer);
      }
    }
  }, [isMobile, neighbors.nextId, neighbors.previousId]);
  useEffect(() => {
    if (!task || task.status === "completed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/tasks/${task.id}`);
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setTask(updated);
        if (updated.status === "completed") {
          clearInterval(interval);
          loadDetail(); // refresh media to reflect new file
        }
      } catch {
        console.warn("Failed to update task progress");
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [task]);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const targetId =
        direction === "prev" ? neighbors.previousId : neighbors.nextId;
      if (targetId) {
        navigate(`/medium/${targetId}/?${queryParams}`, {
          state: { viewContext },
          replace: true,
        });
      }
    },
    [navigate, neighbors, viewContext]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleNavigate("prev");
      if (e.key === "ArrowRight") handleNavigate("next");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavigate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX === null) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNavigate("next");
    } else if (distance < -minSwipeDistance) {
      handleNavigate("prev");
    }
    setTouchStartX(null);
  };

  if (!detail) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const { media } = detail;

  // Dialog controls
  const closeDialog = () => setDialogType(null);

  // Confirm actions
  const confirmConvert = async () => {
    if (!media) return;
    try {
      const res = await fetch(`${API}/api/media/${media.id}/converter`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const t: Task = await res.json();
      setTask(t);
      setSnackbar({
        open: true,
        message: "Conversion started",
        severity: "success",
      });
    } catch {
      setSnackbar({
        open: true,
        message: "Conversion failed",
        severity: "error",
      });
    } finally {
      closeDialog();
    }
  };

  const confirmDeleteRecord = async () => {
    if (!media) return;
    try {
      const res = await fetch(`${API}/api/media/${media.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSnackbar({
        open: true,
        message: "Record deleted",
        severity: "success",
      });
      navigate("/");
    } catch {
      setSnackbar({ open: true, message: "Delete failed", severity: "error" });
    } finally {
      closeDialog();
    }
  };

  const confirmDeleteFile = async () => {
    if (!media) return;
    try {
      const res = await fetch(`${API}/api/media/${media.id}/file`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSnackbar({ open: true, message: "File deleted", severity: "success" });
      navigate("/");
    } catch {
      setSnackbar({
        open: true,
        message: "File delete failed",
        severity: "error",
      });
    } finally {
      closeDialog();
    }
  };
  {
    console.log(showSwipeHint);
  }
  const handleToggleExif = () => {
    setTabValue(3);
  };
  return (
    <Container maxWidth="xl" sx={{ pt: 2, pb: 6 }}>
      <MediaHeader
        media={media}
        showExif={tabValue === 3} // The button text can reflect if the Details tab is active
        onToggleExif={handleToggleExif} // CHANGED: This now controls the tabs
        onOpenDialog={setDialogType}
      />
      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {!isMobile && (
          <IconButton
            onClick={() => handleNavigate("prev")}
            disabled={!neighbors.previousId}
            sx={{
              position: "absolute",
              left: -60,
              zIndex: 1,
              "&.Mui-disabled": { opacity: 0.2 },
            }}
          >
            <ArrowBackIosNew fontSize="large" />
          </IconButton>
        )}
        <Box
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          sx={{ width: "100%" }}
        >
          <MediaDisplay media={media} />
        </Box>
        <Fade in={showSwipeHint}>
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              color: "white",
              pointerEvents: "none", // Allow swipes to pass through
              zIndex: 100,
            }}
          >
            <ArrowBackIosNew sx={{ fontSize: "2.5rem", opacity: 0.6 }} />
            <Typography
              sx={{
                bgcolor: "rgba(0,0,0,0.6)",
                px: 2,
                py: 1,
                borderRadius: 2,
                userSelect: "none",
              }}
            >
              Swipe to navigate
            </Typography>
            <ArrowForwardIos sx={{ fontSize: "2.5rem", opacity: 0.6 }} />
          </Box>
        </Fade>
        {!isMobile && (
          <IconButton
            onClick={() => handleNavigate("next")}
            disabled={!neighbors.nextId}
            sx={{
              position: "absolute",
              right: -60,
              zIndex: 1,
              "&.Mui-disabled": { opacity: 0.2 },
            }}
          >
            <ArrowForwardIos fontSize="large" />
          </IconButton>
        )}
      </Box>
      <ActionDialogs
        dialogType={dialogType}
        onClose={() => setDialogType(null)}
        onConfirmConvert={confirmConvert}
        onConfirmDeleteRecord={confirmDeleteRecord}
        onConfirmDeleteFile={confirmDeleteFile}
      />
      {/* --- Tabbed Content Area --- */}
      <MediaContentTabs
        detail={detail}
        onDetailReload={loadDetail}
        onTagUpdate={(updatedMedia) =>
          setDetail((d) => (d ? { ...d, media: updatedMedia } : null))
        }
      />
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          sx={{ width: "100%" }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {task && task.status === "running" && (
        <Box mb={2}>
          <Typography variant="body2" gutterBottom>
            Converting… {task.processed}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={task.processed}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>
      )}
    </Container>
  );
}
