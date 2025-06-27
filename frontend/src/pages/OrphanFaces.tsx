import React, { useCallback } from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  CircularProgress,
} from "@mui/material";
import { useInfinite, PageResponse } from "../hooks/useInfinite";
import FaceCard from "../components/FaceCard";
import { FaceRead } from "../types";
import { getOrphanFaces } from "../services/face";
import { assignFace, createPersonFromFaces, deleteFace, detachFace } from "../services/faceActions";

const ITEMS_PER_PAGE = 48;

export default function OrphanFacesPage() {
  const fetchOrphans = useCallback(
    async (page: number, limit: number): Promise<PageResponse<FaceRead>> => {
      const data = await getOrphanFaces(page);
      return { items: data, next_page: data.length === 0 ? null : page + 1 };
    },
    []
  );

  const {
    items: orphans,
    setItems: setOrphans,
    hasMore,
    loading,
    loaderRef,
  } = useInfinite<FaceRead>(fetchOrphans, ITEMS_PER_PAGE, []);

  // assign a face to an existing person
  async function handleAssignFace(faceId: number, personId: number) {
    await assignFace(faceId, personId);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
  }

  // create a new person from a face
  async function handleCreatePersonFromFace(faceId: number, data: any) {
    const p = await createPersonFromFaces([faceId], data);
    if (p?.id) window.location.href = `/person/${p.id}`;
  }

  // delete a face entirely
  async function handleDeleteFace(faceId: number) {
    await deleteFace(faceId);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
  }
  // detach a face
  async function handleDetachFace(faceId: number) {
    await detachFace(faceId);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
  }

  // initial loading state
  if (loading && orphans.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  // no orphans
  if (!loading && orphans.length === 0) {
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
    <Container
      maxWidth={false}
      sx={{ pt: 4, pb: 7, bgcolor: "background.default" }}
    >
      <Typography variant="h4" color="text.primary" gutterBottom>
        Unassigned Faces
      </Typography>

      <Grid container spacing={2}>
        {orphans.map((face) => (
          <Grid key={face.id} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
            <FaceCard
              face={face}
              isProfile={false}
              onSetProfile={() => {}}
              onAssign={(pid) => handleAssignFace(face.id, pid)}
              onCreate={(data) => handleCreatePersonFromFace(face.id, data)}
              onDelete={() => handleDeleteFace(face.id)}
              onDetach={() => handleDetachFace(face.id)}
            />
          </Grid>
        ))}
      </Grid>

      {loading && (
        <Box textAlign="center" py={2}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {!loading && hasMore && (
        <Box
          ref={loaderRef}
          textAlign="center"
          py={2}
          sx={{ color: "text.secondary" }}
        >
          Scroll to load more…
        </Box>
      )}
    </Container>
  );
}
