import React, { useCallback } from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  CircularProgress,
} from "@mui/material";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import FaceCard from "../components/FaceCard";
import { FaceRead } from "../types";
import { API } from "../config";

const ITEMS_PER_PAGE = 48;

export default function OrphanFacesPage() {
  const fetchOrphans = useCallback(
    (cursor: string | null, limit: number) =>
      fetch(
        `${API}/api/faces/orphans${
          cursor ? `?cursor=${cursor}&` : "?"
        }limit=${limit}`
      ).then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<CursorResponse<FaceRead>>;
      }),
    [API]
  );

  const {
    items: orphans,
    setItems: setOrphans,
    hasMore,
    loading,
    loaderRef,
  } = useInfinite<FaceRead>(fetchOrphans, ITEMS_PER_PAGE, []);

  // assign a face to an existing person
  async function assignFace(faceId: number, personId: number) {
    await fetch(`${API}/api/faces/${faceId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: personId }),
    });
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
  }

  // create a new person from a face
  async function createPersonFromFace(faceId: number, data: any) {
    const res = await fetch(`${API}/api/faces/${faceId}/create_person`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    const p = (json as any).person ?? (json as any);
    if (p?.id) window.location.href = `/person/${p.id}`;
  }

  // delete a face entirely
  async function deleteFace(faceId: number) {
    await fetch(`${API}/api/faces/${faceId}`, { method: "DELETE" });
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
  }
  // detach a face
  async function detachFace(faceId: number) {
    await fetch(`${API}/api/faces/${faceId}/detach`, { method: "POST" });
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
              onAssign={(pid) => assignFace(face.id, pid)}
              onCreate={(data) => createPersonFromFace(face.id, data)}
              onDelete={() => deleteFace(face.id)}
              onDetach={() => detachFace(face.id)}
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
