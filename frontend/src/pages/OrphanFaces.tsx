import React, { useCallback, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import FaceCard from "../components/FaceCard";
import { FaceRead } from "../types";
import { useInView } from "react-intersection-observer";
import { getOrphanFaces } from "../services/face";
import { useListStore, defaultListState } from "../stores/useListStore";
import {
  assignFace,
  createPersonFromFaces,
  deleteFace,
  detachFace,
} from "../services/faceActions";

const ITEMS_PER_PAGE = 48;

export default function OrphanFacesPage() {
  const navigate = useNavigate();
  const listKey = "orphan-faces";

  const {
    items: orphans,
    hasMore,
    isLoading,
  } = useListStore((state) => state.lists[listKey] || defaultListState);
  const { fetchInitial, loadMore, removeItem } = useListStore();
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    fetchInitial(listKey, () => getOrphanFaces(null));
  }, [fetchInitial, listKey]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(listKey, (cursor) => getOrphanFaces(cursor));
    }
  }, [inView, hasMore, isLoading, loadMore, listKey]);

  // assign a face to an existing person
  const handleAssignFace = async (faceId: number, personId: number) => {
    await assignFace([faceId], personId);
    // Optimistically remove the face from the list using the store's action
    removeItem(listKey, faceId);
  };

  // create a new person from a face
  const handleCreatePersonFromFace = async (faceId: number, data: any) => {
    const p = await createPersonFromFaces([faceId], data.name);
    // Optimistically remove the face from this list
    removeItem(listKey, faceId);
    // Use navigate for a smooth SPA transition instead of a full page reload
    if (p?.id) navigate(`/person/${p.id}`);
  };

  // delete a face entirely
  const handleDeleteFace = async (faceId: number) => {
    await deleteFace([faceId]);
    // Optimistically remove the face from the list
    removeItem(listKey, faceId);
  };

  // initial loading state
  if (isLoading && orphans.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  // no orphans
  if (!isLoading && orphans.length === 0) {
    return (
      <Typography
        variant="body1"
        align="center"
        sx={{ py: 4, color: "text.secondary" }}
      >
        No unassigned faces.
      </Typography>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ pt: 4, pb: 7 }}>
      <Typography variant="h4" gutterBottom>
        Unassigned Faces ({orphans.length})
      </Typography>

      {orphans.length === 0 && !isLoading ? (
        <Typography
          variant="body1"
          align="center"
          sx={{ py: 4, color: "text.secondary" }}
        >
          No unassigned faces found. Great job!
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {orphans.map((face) => (
            <Grid key={face.id} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
              <FaceCard
                face={face}
                isProfile={false}
                onAssign={(pid) => handleAssignFace(face.id, pid)}
                onCreate={(data) => handleCreatePersonFromFace(face.id, data)}
                onDelete={() => handleDeleteFace(face.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {isLoading && orphans.length > 0 && (
        <Box textAlign="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Sentinel for infinite scroll */}
      {hasMore && <Box ref={loaderRef} sx={{ height: "10px" }} />}
    </Container>
  );
}
