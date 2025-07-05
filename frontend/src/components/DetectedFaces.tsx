import React, { useRef, useCallback, useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Stack,
  Paper,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from "@mui/material";
import { FaceRead, Person } from "../types";
import FaceCard from "./FaceCard";
import { useFaceSelection } from "../hooks/useFaceSelection";

interface DetectedFacesProps {
  isProcessing: boolean;
  faces: FaceRead[];
  title: string;
  onDelete: (faceIds: number[]) => void;
  onDetach: (faceIds: number[]) => void;
  onAssign: (faceIds: number[], personId: number) => void;
  onCreateMultiple?: (faceIds: number[], name?: string) => Promise<Person>;
  personId?: number; // Make optional for orphan faces

  // --- Profile Actions ---
  profileFaceId?: number;
  onSetProfile?: (faceId: number) => void;

  // --- Infinite Scroll ---
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;

  disableInternalScroll?: boolean;
}

export default function DetectedFaces({
  isProcessing,
  faces,
  title,
  onDelete,
  onDetach,
  onAssign,
  personId,
  profileFaceId,
  onSetProfile,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onCreateMultiple,
  disableInternalScroll = false,
}: DetectedFacesProps) {
  const theme = useTheme();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const {
    selectedFaceIds,
    onToggleSelect,
    onSelectAll,
    onClearSelection,
    setSelectedFaceIds,
  } = useFaceSelection();
  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoadingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            hasMore &&
            onLoadMore &&
            !isLoadingMore
          ) {
            onLoadMore();
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px 100px 0px" } // Trigger when 100px from bottom
      );

      if (node) observerRef.current.observe(node);
    },
    [isLoadingMore, hasMore, onLoadMore]
  );

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const isAnythingSelected = selectedFaceIds.length > 0;
  useEffect(() => {
    onClearSelection();
  }, [personId]);
  if (
    faces.length === 0 &&
    !isLoadingMore &&
    !hasMore &&
    title === "Detected Faces"
  ) {
    return null;
  }
  if (faces.length === 0 && isLoadingMore && onLoadMore) {
    return null;
  }

  const handleAssign = async (
    faceIds: number[],
    assignedToPersonId: number
  ) => {
    await onAssign(faceIds, assignedToPersonId);
    onClearSelection();
  };

  const scrollContainerSx = !disableInternalScroll
    ? {
        maxHeight: "400px",
        overflowY: "auto",
        pr: 1, // Padding for scrollbar
        // Custom scrollbar styling
        "&::-webkit-scrollbar": { width: "8px" },
        "&::-webkit-scrollbar-track": {
          background: theme.palette.background.default,
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: theme.palette.divider,
          borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
          background: theme.palette.text.secondary,
        },
      }
    : {};

  return (
    <Paper variant="outlined" sx={{ p: 2, my: 4 }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {isAnythingSelected && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" onClick={onClearSelection}>
              {selectedFaceIds.length} selected
            </Button>
            <Box sx={{ flexGrow: 1 }} />

            {personId && (
              <Button
                variant="contained"
                size="small"
                disabled={isProcessing}
                onClick={() => handleAssign(selectedFaceIds, personId)}
              >
                Assign
              </Button>
            )}
            {onCreateMultiple && (
              <Button
                variant="contained"
                size="small"
                disabled={isProcessing}
                onClick={() => setOpenCreateDialog(true)}
              >
                Create New
              </Button>
            )}
            {onDetach && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                disabled={isProcessing}
                onClick={() => onDetach(selectedFaceIds)}
              >
                Detach
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={isProcessing}
                onClick={() => onDelete(selectedFaceIds)}
              >
                Delete
              </Button>
            )}
            {isProcessing && <CircularProgress size={20} />}
          </Stack>
        )}
        <Button size="small" onClick={() => onSelectAll(faces)}>
          {selectedFaceIds.length < faces.length ? "Select All" : "Select None"}
        </Button>
      </Box>
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
      >
        <DialogTitle>Create New Person</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Person Name"
            type="text"
            fullWidth
            variant="standard"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (onCreateMultiple) {
                await onCreateMultiple(selectedFaceIds, newPersonName);
                setOpenCreateDialog(false);
                setSelectedFaceIds([]);
                setNewPersonName("");
              }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      {/* --- Faces Grid --- */}
      <Box sx={scrollContainerSx}>
        {faces.length === 0 && !isLoadingMore ? (
          <Typography
            sx={{ textAlign: "center", p: 4, color: "text.secondary" }}
          >
            No faces to display.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "flex-start",
            }}
          >
            {faces.map((face, index) => (
              <div
                key={face.id}
                // Only attach the internal scroller's ref if internal scroll is enabled
                ref={
                  !disableInternalScroll && index === faces.length - 1
                    ? lastCardRef
                    : null
                }
                style={{ padding: "4px" }}
              >
                <FaceCard
                  face={face}
                  isProfile={face.id === profileFaceId}
                  onSetProfile={onSetProfile}
                  selected={selectedFaceIds.includes(face.id)}
                  onToggleSelect={onToggleSelect}
                />
              </div>
            ))}
          </Box>
        )}
        {isLoadingMore && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    </Paper>
  );
}
