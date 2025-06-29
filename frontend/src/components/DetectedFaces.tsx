import React, { useRef, useEffect, useCallback, useState } from "react";
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
import Masonry from "react-masonry-css";
import { FaceRead, Person } from "../types";
import FaceCard from "./FaceCard";

interface DetectedFacesProps {
  isProcessing: boolean;
  faces: FaceRead[];
  title: string;
  onDelete: (faceIds: number[]) => void;
  onDetach: (faceIds: number[]) => void;
  onAssign: (faceIds: number[], personId: number) => void;
  onCreateMultiple?: (faceIds: number[], name?: string) => Promise<Person>;
  personId?: number; // Make optional for orphan faces
  onClearSelection?: () => void;

  // --- Individual Actions ---
  allowIndividualActions?: boolean; // New prop to control single actions
  onSingleFaceDelete?: (faceId: number) => void;
  onSingleFaceAssign?: (faceId: number, personId: number) => void;
  onSingleFaceCreate?: (faceId: number, name: string) => void;

  // --- Profile Actions ---
  profileFaceId?: number;
  onSetProfile?: (faceId: number) => void;

  // --- Infinite Scroll ---
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const breakpointColumnsObj = {
  default: 6, // Default to 6 columns
  1600: 5,
  1200: 4,
  900: 3,
  600: 2,
};

export default function DetectedFaces({
  isProcessing,
  faces,
  title,
  onDelete,
  onDetach,
  onAssign,
  personId,
  onClearSelection,
  allowIndividualActions = false, // Default to false
  onSingleFaceDelete,
  onSingleFaceAssign,
  onSingleFaceCreate,
  profileFaceId,
  onSetProfile,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onCreateMultiple,
}: DetectedFacesProps) {
  const theme = useTheme();
  const observerRef = useRef<IntersectionObserver | null>(null);
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

  const [selectedFaceIds, setSelectedFaceIds] = useState<number[]>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const isAnythingSelected = selectedFaceIds.length > 0;

  const handleToggleSelect = useCallback((faceId: number) => {
    setSelectedFaceIds((prevSelected) =>
      prevSelected.includes(faceId)
        ? prevSelected.filter((id) => id !== faceId)
        : [...prevSelected, faceId]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedFaceIds([]);
    if (onClearSelection) {
      onClearSelection();
    }
  }, [onClearSelection]);

  useEffect(() => {
    setSelectedFaceIds([]);
  }, [faces]);

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

  return (
    <Paper variant="outlined" sx={{ p: 2, my: 4 }}>
      <Box sx={{ mb: 1 }}>
        {!isAnythingSelected ? (
          <Typography variant="h6">{title}</Typography>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 1,
              bgcolor: "action.selected",
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" onClick={handleClearSelection}>
                {selectedFaceIds.length} selected
              </Button>
              <Box sx={{ flexGrow: 1 }} />

              {onAssign && personId && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={isProcessing}
                  onClick={() => onAssign(selectedFaceIds, personId)}
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
          </Paper>
        )}
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
      <Box
        sx={{
          maxHeight: "350px",
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
        }}
      >
        {faces.length === 0 && !isLoadingMore ? (
          <Typography
            sx={{ textAlign: "center", p: 4, color: "text.secondary" }}
          >
            No faces to display.
          </Typography>
        ) : (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {faces.map((face, index) => (
              <div
                key={face.id}
                ref={index === faces.length - 1 ? lastCardRef : null}
                style={{ padding: "4px" }}
              >
                <FaceCard
                  face={face}
                  isProfile={face.id === profileFaceId}
                  onSetProfile={onSetProfile}
                  selectable={!allowIndividualActions}
                  selected={selectedFaceIds.includes(face.id)}
                  onToggleSelect={handleToggleSelect}
                  showActions={allowIndividualActions && !isAnythingSelected}
                  onDelete={
                    onSingleFaceDelete
                      ? () => onSingleFaceDelete(face.id)
                      : undefined
                  }
                  onAssign={
                    onSingleFaceAssign
                      ? (pid) => onSingleFaceAssign(face.id, pid)
                      : undefined
                  }
                  onCreate={
                    onSingleFaceCreate
                      ? (data) => onSingleFaceCreate(face.id, data)
                      : undefined
                  }
                />
              </div>
            ))}
          </Masonry>
        )}
        {isLoadingMore && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
      {/* Create Dialog remains the same */}
    </Paper>
  );
}
