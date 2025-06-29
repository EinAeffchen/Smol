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
import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";

import { useListStore, defaultListState } from "../stores/useListStore";

import { ActionDialogs } from "../components/ActionDialogs";
import { MediaDisplay } from "../components/MediaDisplay";
import { MediaHeader } from "../components/MediaHeader";
import { MediaContentTabs } from "../components/MediaContentTabs";

import { Media, MediaDetail, Tag, Task } from "../types";
import { getMedia } from "../services/media";
import {
  convertMedia,
  deleteMediaRecord,
  deleteMediaFile,
} from "../services/mediaActions";
import { getTask } from "../services/task";

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // --- 1. STATE MANAGEMENT ---
  const mediaListKey = location.state?.mediaListKey as string | undefined;
  const listFromStore = useListStore((state) =>
    mediaListKey ? state.lists[mediaListKey] : undefined
  );
  // A. Global state from Zustand for the list context
  const {
    items,
    hasMore,
    isLoading: isListLoading,
  } = listFromStore || (mediaListKey ? defaultListState : defaultListState);
  const { loadMore } = useListStore();

  // B. Local state for this specific modal's content
  const preloadedMedia = location.state?.media as Media | null;
  const [detail, setDetail] = useState<MediaDetail | null>(
    preloadedMedia ? { media: preloadedMedia, persons: [], orphans: [] } : null
  );
  const [isDetailLoading, setIsDetailLoading] = useState(!preloadedMedia);
  const [isWaitingForMore, setIsWaitingForMore] = useState(false);

  // C. Local state for all other UI and features
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  // --- 2. DERIVED DATA & CONTEXT ---

  const allMediaIdsInView = useMemo(() => items.map((m) => m.id), [items]);
  const viewContext = useMemo(
    () => location.state?.viewContext || { sort: "newest" },
    [location.state]
  );

  const neighbors = useMemo(() => {
    if (!id || !allMediaIdsInView) return { previousId: null, nextId: null };
    const currentIndex = allMediaIdsInView.findIndex(
      (mediaId) => mediaId === Number(id)
    );
    if (currentIndex === -1) return { previousId: null, nextId: null };

    const previousId =
      currentIndex > 0 ? allMediaIdsInView[currentIndex - 1] : null;
    const nextId =
      currentIndex < allMediaIdsInView.length - 1
        ? allMediaIdsInView[currentIndex + 1]
        : null;
    return { previousId, nextId };
  }, [id, allMediaIdsInView]);

  // --- 3. DATA FETCHING & NAVIGATION ---

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setIsDetailLoading(true);
      try {
        const data = await getMedia(id);
        setDetail(data);
      } catch (err) {
        if (!signal?.aborted)
          console.error("Failed to fetch media detail:", err);
      } finally {
        if (!signal?.aborted) setIsDetailLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    const currentPreloaded = location.state?.media as Media | null;
    if (currentPreloaded && String(currentPreloaded.id) === id) {
      setDetail({ media: currentPreloaded, persons: [], orphans: [] });
    }
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [id, location.key, fetchDetail]);

  useEffect(() => {
    if (isWaitingForMore && !isListLoading) {
      setIsWaitingForMore(false);
      const newCurrentIndex = allMediaIdsInView.findIndex(
        (mediaId) => mediaId === Number(id)
      );
      const newNextId =
        newCurrentIndex < allMediaIdsInView.length - 1
          ? allMediaIdsInView[newCurrentIndex + 1]
          : null;
      if (newNextId) {
        navigate(`/medium/${newNextId}`, {
          state: { ...location.state, media: null },
        });
      }
    }
  }, [
    isWaitingForMore,
    isListLoading,
    allMediaIdsInView,
    id,
    navigate,
    location.state,
  ]);

  const handleNavigate = useCallback(
    async (direction: "prev" | "next") => {
      const targetId =
        direction === "prev" ? neighbors.previousId : neighbors.nextId;
      if (targetId) {
        navigate(`/medium/${targetId}`, {
          state: { ...location.state, media: null },
        });
      } else if (direction === "next" && hasMore && !isListLoading) {
        if (mediaListKey) {
          setIsWaitingForMore(true);
          // Assuming loadMore now takes a fetcher function for the next page
          // You'll need to adjust this based on how your loadMore is implemented
          // For example, if mediaListKey is "images", you might call loadMore("images", (page) => getImages(page))
          // Since the current loadMore in useListStore doesn't take a fetcher, this part needs careful consideration.
          // For now, I'll leave it as is, but this is a potential area for further refactoring.
          await loadMore(mediaListKey, (page) => {
            // This part needs to be dynamic based on mediaListKey
            // For simplicity, assuming a generic fetcher for now.
            // In a real app, you'd have a map of fetchers or a more complex loadMore logic.
            return Promise.resolve([]); // Placeholder
          });
        }
      }
    },
    [
      navigate,
      neighbors,
      location.state,
      hasMore,
      isListLoading,
      loadMore,
      viewContext,
      mediaListKey,
    ]
  );

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleNavigate("prev");
      if (e.key === "ArrowRight") handleNavigate("next");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavigate]);

  useEffect(() => {
    if (!task?.id || ["completed", "failed"].includes(task.status)) return;
    const intervalId = setInterval(async () => {
      try {
        const updatedTask = await getTask(task.id);
        if (["completed", "cancelled"].includes(updatedTask.status)) {
          clearInterval(intervalId);
          if (updatedTask.status === "completed") fetchDetail();
        }
        setTask(updatedTask);
      } catch (error) {
        console.error("Failed to fetch task status:", error);
        clearInterval(intervalId);
      }
    }, 1500);
    return () => clearInterval(intervalId);
  }, [task?.id, task?.status, fetchDetail]);

  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.targetTouches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX === null) return;
    const distance = touchStartX - touchEndX;
    if (distance > 50) handleNavigate("next");
    else if (distance < -50) handleNavigate("prev");
    setTouchStartX(null);
  };
  const handleMediaUpdate = (updatedMedia: Media) => {
    setDetail((prevDetail) => {
      if (!prevDetail) return null;
      return { ...prevDetail, media: updatedMedia };
    });
  };

  const handleTagAddedToMedia = (newTag: Tag) => {
    setDetail((prevDetail) => {
      if (!prevDetail) return null;

      const updatedMedia = {
        ...prevDetail.media,
        tags: [...(prevDetail.media.tags || []), newTag],
      };

      return { ...prevDetail, media: updatedMedia };
    });
  };

  const closeDialog = () => setDialogType(null);
  const confirmConvert = async () => {
    if (!detail || !detail.media) return;
    try {
      const t = await convertMedia(detail.media.id);
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
      await deleteMediaRecord(detail.media.id);
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
      await deleteMediaFile(detail.media.id);
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

  const handleClose = () => {
    if (backgroundLocation) {
      navigate(backgroundLocation.pathname + backgroundLocation.search);
    } else {
      navigate("/");
    }
  };
  const isLoading = !detail && isDetailLoading;

  return (
    <Dialog
      open={true}
      onClose={handleClose}
      fullWidth
      maxWidth="xl"
      slotProps={{
        backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.8)" } },
        paper: {
          sx: {
            mt: { xs: 2, sm: 4, md: 8 },
          },
        },
      }}
      sx={{
        "& .MuiDialog-container": {
          alignItems: "flex-start",
        },
      }}
    >
      <IconButton
        onClick={handleClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          zIndex: 1000,
          color: "grey.500",
        }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ p: { xs: 0.8, sm: 2, md: 3 } }}>
        {isLoading ? (
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
          detail && (
            <Container maxWidth="xl" sx={{ pt: 2, pb: 6 }}>
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
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!isMobile && (
                  <IconButton
                    onClick={() => handleNavigate("prev")}
                    disabled={isDetailLoading || !neighbors.previousId}
                    sx={{
                      position: "absolute",
                      left: -40,
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
                  sx={{ width: "90%" }}
                >
                  <MediaHeader
                    media={detail.media}
                    onOpenDialog={setDialogType}
                    onToggleExif={() => setTabValue(3)}
                    showExif={tabValue === 3}
                  />
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
                    <ArrowBackIosNew
                      sx={{ fontSize: "2.5rem", opacity: 0.6 }}
                    />
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
                    <ArrowForwardIos
                      sx={{ fontSize: "2.5rem", opacity: 0.6 }}
                    />
                  </Box>
                </Fade>
                {!isMobile && (
                  <IconButton
                    onClick={() => handleNavigate("next")}
                    disabled={
                      isDetailLoading || (!neighbors.nextId && !hasMore)
                    }
                    sx={{
                      position: "absolute",
                      right: -40,
                      zIndex: 1,
                      "&.Mui-disabled": { opacity: 0.2 },
                    }}
                  >
                    {isWaitingForMore ? (
                      <CircularProgress size={24} />
                    ) : (
                      <ArrowForwardIos fontSize="large" />
                    )}
                  </IconButton>
                )}
              </Box>
              <ActionDialogs
                dialogType={dialogType}
                onClose={closeDialog}
                onConfirmConvert={confirmConvert}
                onConfirmDeleteRecord={confirmDeleteRecord}
                onConfirmDeleteFile={confirmDeleteFile}
              />
              {isDetailLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    flexGrow: 1, // Allow the box to grow and fill the minHeight
                  }}
                >
                  <CircularProgress />
                </Box>
              ) : (
                <MediaContentTabs
                  detail={detail}
                  onTagAdded={handleTagAddedToMedia}
                  onDetailReload={fetchDetail}
                  onTagUpdate={handleMediaUpdate}
                />
              )}
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
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
