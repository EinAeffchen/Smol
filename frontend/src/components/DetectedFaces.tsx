import React, { useRef, useEffect, useCallback, useState } from "react";
import { Box, Typography, CircularProgress, Button, Stack, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import Masonry from "react-masonry-css";
import { FaceRead, Person } from "../types";
import FaceCard from "./FaceCard";

interface DetectedFacesProps {
  faces: FaceRead[];
  profileFaceId?: number;
  title: string;
  onSetProfile?: (faceId: number) => void;
  onAssign: (faceIds: number[], personId: number) => void;
  onCreate: (faceId: number, data: any) => Promise<Person>;
  onDelete: (faceIds: number[]) => void;
  onDetach: (faceIds: number[]) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onClearSelection?: () => void;
  personId?: number;
  onCreateMultiple?: (faceIds: number[], name?: string) => Promise<Person>;
}

const breakpointColumnsObj = {
  default: 6, // Default to 6 columns
  1600: 5,
  1200: 4,
  900: 3,
  600: 2,
};

export default function DetectedFaces({
  faces,
  profileFaceId,
  title,
  onSetProfile,
  onAssign,
  onCreate,
  onDelete,
  onDetach,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onClearSelection,
  personId, // Destructure personId
  onCreateMultiple,
}: DetectedFacesProps) {
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
    // Clear selection if faces change (e.g., new person loaded)
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
    <Box sx={{ my: 4 }}>
      <Typography variant="h6" gutterBottom>
        {title} ({faces.length})
      </Typography>

      {selectedFaceIds.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            onClick={handleClearSelection}
            size="small"
          >
            Clear Selection ({selectedFaceIds.length})
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonSearchIcon />}
            onClick={() => {
              if (personId) {
                onAssign(selectedFaceIds, personId);
              } else {
                console.error("Person ID is not available for assignment.");
              }
            }}
            size="small"
          >
            Assign
          </Button>
          <Button
            variant="contained"
            startIcon={<LinkOffIcon />}
            onClick={() => onDetach(selectedFaceIds)}
            size="small"
          >
            Detach
          </Button>
          <Button
            variant="contained"
            startIcon={<DeleteIcon />}
            onClick={() => onDelete(selectedFaceIds)}
            size="small"
            color="error"
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenCreateDialog(true)}
            size="small"
          >
            Create New
          </Button>
        </Stack>
      )}

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
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
          <Button onClick={async () => {
            if (onCreateMultiple) {
              await onCreateMultiple(selectedFaceIds, newPersonName);
              setOpenCreateDialog(false);
              setSelectedFaceIds([]);
              setNewPersonName("");
            }
          }}>Create</Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          maxHeight: "280px", // Approximate height for two rows of FaceCards (130px height + spacing)
          overflowY: "auto",
          overflowX: "hidden",
          py: 1,
          pr: 2,
          position: "relative",
        }}
      >
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="my-masonry-grid"
          columnClassName="my-masonry-grid_column"
        >
          {faces.map((face, index) => (
            <div
              key={face.id}
              ref={
                index === faces.length - 1 && hasMore && onLoadMore
                  ? lastCardRef
                  : null
              }
              style={{ padding: "4px" }} // Add padding here
            >
              <FaceCard
                face={face}
                isProfile={face.id === profileFaceId}
                onSetProfile={onSetProfile}
                selectable={true}
                selected={selectedFaceIds.includes(face.id)}
                onToggleSelect={handleToggleSelect}
                showActions={false} // Hide individual actions when multi-select is active
              />
            </div>
          ))}
        </Masonry>
        {isLoadingMore && onLoadMore && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "60px",
              py: 2,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
