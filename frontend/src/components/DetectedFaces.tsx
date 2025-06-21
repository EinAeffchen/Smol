import React, { useRef, useEffect, useCallback } from "react";
import { Box, Stack, Typography, CircularProgress } from "@mui/material";
import { FaceRead, Person } from "../types";
import FaceCard from "./FaceCard";

interface DetectedFacesProps {
  faces: FaceRead[];
  profileFaceId?: number;
  title: string;
  onSetProfile?: (faceId: number) => void;
  onAssign: (faceId: number, personId: number) => void;
  onCreate: (faceId: number, data: any) => Promise<Person>;
  onDelete: (faceId: number) => void;
  onDetach: (faceId: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

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

      <Stack
        direction="row"
        spacing={2}
        sx={{
          overflowX: "auto",
          overflowY: "hidden",
          py: 1,
          pr: 2,
          position: "relative",
        }}
      >
        {faces.map((face, index) => (
          <Box
            key={face.id}
            ref={
              index === faces.length - 1 && hasMore && onLoadMore
                ? lastCardRef
                : null
            }
            sx={{ flex: "0 0 auto", width: 130 }}
          >
            <FaceCard
              face={face}
              isProfile={face.id === profileFaceId}
              onSetProfile={() => onSetProfile(face.id)}
              onAssign={(personId) => onAssign(face.id, personId)}
              onCreate={(data) => onCreate(face.id, data)}
              onDelete={() => onDelete(face.id)}
              onDetach={() => onDetach(face.id)}
            />
          </Box>
        ))}
        {isLoadingMore && onLoadMore && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "60px",
              pl: 1,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
      </Stack>
    </Box>
  );
}
