import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Box,
  Dialog,
  DialogContent,
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
import { useFaceActions } from "../hooks/useFaceActions";
import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";
import { ActionDialogs } from "../components/ActionDialogs";
import { MediaDisplay } from "../components/MediaDisplay";
import { MediaHeader } from "../components/MediaHeader";
import { Media, MediaDetail, MediaPreview, Task } from "../types";
import { API } from "../config";
import { MediaContentTabs } from "../components/MediaContentTabs";
import CloseIcon from "@mui/icons-material/Close";

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const faceActions = useFaceActions();

  const preloadedMedia = location.state?.media as Media | null;
  const [detail, setDetail] = useState<MediaDetail | null>(
    preloadedMedia ? { media: preloadedMedia, persons: [], orphans: [] } : null
  );
  const [loading, setLoading] = useState(!preloadedMedia);
  const [neighborLoading, setNeighborLoading] = useState(!preloadedMedia);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
    previousMedia: MediaPreview | null;
    nextMedia: MediaPreview | null;
  }>({ previousMedia: null, nextMedia: null });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const viewContext = useMemo(
    () => location.state?.viewContext || { sort: "newest" },
    [location.state]
  );
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("sort", viewContext.sort || "newest");
    if (viewContext.filterPeople && viewContext.filterPeople.length > 0) {
      viewContext.filterPeople.forEach((personId) => {
        params.append("filter_people", String(personId));
      });
    }
    return params.toString();
  }, [viewContext]);

  // Load media detail
  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const res = await fetch(`${API}/api/media/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDetail(data);
      } catch (err) {
        if (signal?.aborted !== true) {
          setSnackbar({
            open: true,
            message: "Failed to load media",
            severity: "error",
          });
        }
      }
    },
    [id]
  );

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      // Use preloaded data for an instant UI update, but still fetch full data
      const currentPreloaded = location.state?.media as Media | null;
      if (currentPreloaded && String(currentPreloaded.id) === id) {
        setDetail({ media: currentPreloaded, persons: [], orphans: [] });
      } else {
        setDetail(null);
      }

      setNeighborLoading(true);
      try {
        const [neighborsRes] = await Promise.all([
          fetch(`${API}/api/media/${id}/neighbors?${queryParams}`, { signal }),
        ]);
        if (neighborsRes.ok) {
          const neighborsData = await neighborsRes.json();
          setNeighbors({
            previousMedia: neighborsData.previous_media,
            nextMedia: neighborsData.next_media,
          });
          setNeighborLoading(false);
        }
      } catch (err) {
        if (signal.aborted !== true) {
          console.error("Failed to load page data:", err);
          setSnackbar({
            open: true,
            message: "Failed to load media",
            severity: "error",
          });
        }
      } finally {
        if (signal.aborted !== true) {
          setNeighborLoading(false);
        }
      }

      try {
        // Fetch detail and neighbors in parallel
        const [detailRes] = await Promise.all([
          fetch(`${API}/api/media/${id}`, { signal }),
        ]);

        if (!detailRes.ok) throw new Error("Failed to fetch media detail");
        const detailData = await detailRes.json();
        setDetail(detailData);
      } catch (err) {
        if (signal.aborted !== true) {
          console.error("Failed to load page data:", err);
          setSnackbar({
            open: true,
            message: "Failed to load media",
            severity: "error",
          });
        }
      } finally {
        if (signal.aborted !== true) {
          setLoading(false);
        }
      }
    };
    fetchData();

    return () => controller.abort();
  }, [id, location.key, queryParams]);

  useEffect(() => {
    if (isMobile && (neighbors.nextMedia || neighbors.previousMedia)) {
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
  }, [isMobile, neighbors.nextMedia, neighbors.previousMedia]);

  useEffect(() => {
    if (!task?.id || ["completed", "failed"].includes(task.status)) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/tasks/${task.id}`);
        if (!res.ok) {
          // Stop polling on server errors
          console.warn("Task polling failed with server error.");
          clearInterval(intervalId);
          return;
        }
        const updatedTask = await res.json();

        if (["completed", "cancelled"].includes(updatedTask.status)) {
          clearInterval(intervalId);
          setTask(updatedTask);
          if (updatedTask.status === "completed") {
            console.log("Task completed, reloading details...");
            loadDetail();
          }
        } else {
          setTask(updatedTask);
        }
      } catch {
        console.warn("Failed to update task progress");
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [task?.id, task?.status, loadDetail]);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const target =
        direction === "prev" ? neighbors.previousMedia : neighbors.nextMedia;
      console.log(`Target: ${target}`);
      if (target) {
        const backgroundLocation = location.state?.backgroundLocation;

        navigate(`/medium/${target.id}/?${queryParams}`, {
          replace: true,
          state: {
            backgroundLocation: backgroundLocation,
            viewContext,
            media: target,
          },
        });
      }
    },
    [navigate, neighbors, viewContext, location, queryParams]
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

  // Dialog controls
  const closeDialog = () => setDialogType(null);

  // Confirm actions
  const confirmConvert = async () => {
    if (!detail || !detail.media) return;
    try {
      const res = await fetch(`${API}/api/media/${detail.media.id}/converter`, {
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
    if (!detail || !detail.media) return;
    try {
      const res = await fetch(`${API}/api/media/${detail.media.id}`, {
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
    if (!detail || !detail.media) return;
    try {
      const res = await fetch(`${API}/api/media/${detail.media.id}/file`, {
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
  const handleAssignFace = async (faceId: number, personId: number) => {
    await faceActions.assignFace(faceId, personId);
    loadDetail(); // This is the refresh trigger
  };

  const handleDeleteFace = async (faceId: number) => {
    await faceActions.deleteFace(faceId);
    loadDetail();
  };

  const handleDetachFace = async (faceId: number) => {
    await faceActions.detachFace(faceId);
    loadDetail();
  };

  const handleCreateFace = async (
    faceId: number,
    data: any
  ): Promise<Person> => {
    const newPerson = await faceActions.createPersonFromFace(faceId, data);
    loadDetail(); // Refresh to update all counts and lists
    return newPerson;
  };

  const handleToggleExif = () => {
    setTabValue(3);
  };
  const handleClose = () => {
    navigate(-1); // This is equivalent to clicking the browser's back button
  };
  return (
    <Dialog
      open={true}
      onClose={handleClose}
      fullWidth
      maxWidth="xl" // Use a large max-width for the detail view
      slotProps={{
        backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.8)" } },
      }}
    >
      <IconButton
        onClick={handleClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: "grey.500",
          zIndex: 1,
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* You can use DialogContent to wrap your page's content */}
      <DialogContent sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        {!detail ? (
          // This now acts as the loading state for the very first render if no preloaded data exists
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "80vh",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Container maxWidth="xl" sx={{ pt: 2, pb: 6 }}>
            <MediaHeader
              media={detail.media}
              showExif={tabValue === 3}
              onToggleExif={handleToggleExif}
              onOpenDialog={setDialogType}
            />
            {task &&
              (task.status === "running" || task.status === "pending") && (
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
                  disabled={!neighbors.previousMedia || neighborLoading}
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
                <MediaDisplay media={detail.media} />
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
                  disabled={!neighbors.nextMedia || neighborLoading}
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
          </Container>
        )}
      </DialogContent>
    </Dialog>
  );
}
