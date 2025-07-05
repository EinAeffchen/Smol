// components/FaceManager.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  CircularProgress,
} from "@mui/material";
import { FaceGrid } from "./FaceGrid";
import { FaceRead } from "../types";

interface FaceManagerProps {
  isProcessing: boolean;
  faces: FaceRead[];
  title: string;
  onDelete: (faceIds: number[]) => void;
  onAssign: (faceIds: number[]) => void;
  onCreate: (faceIds: number[], name: string) => void;
}

export const FaceManager: React.FC<FaceManagerProps> = ({
  isProcessing,
  faces,
  title,
  onDelete,
  onAssign,
}) => {
  const [selectedFaceIds, setSelectedFaceIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedFaceIds([]);
  }, [faces]);

  const handleToggleSelect = useCallback((faceId: number) => {
    setSelectedFaceIds((prev) =>
      prev.includes(faceId)
        ? prev.filter((id) => id !== faceId)
        : [...prev, faceId]
    );
  }, []);

  const handleSelectAll = () => {
    if (selectedFaceIds.length < faces.length) {
      setSelectedFaceIds(faces.map((f) => f.id));
    } else {
      setSelectedFaceIds([]);
    }
  };

  const isAnythingSelected = selectedFaceIds.length > 0;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        <Button size="small" onClick={handleSelectAll}>
          {selectedFaceIds.length < faces.length ? "Select All" : "Select None"}
        </Button>
      </Box>

      {isAnythingSelected && (
        <Paper elevation={2} sx={{ p: 1, mb: 2, bgcolor: "action.selected" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ ml: 1 }} variant="subtitle1">
              {selectedFaceIds.length} selected
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              size="small"
              disabled={isProcessing}
              onClick={() => onAssign(selectedFaceIds)}
            >
              Assign to Person...
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={isProcessing}
              onClick={() => {
                /* Open create dialog */
              }}
            >
              Create New Person
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={isProcessing}
              onClick={() => onDelete(selectedFaceIds)}
            >
              Delete
            </Button>
            {isProcessing && <CircularProgress size={20} />}
          </Stack>
        </Paper>
      )}

      <FaceGrid
        faces={faces}
        selectedFaceIds={selectedFaceIds}
        onToggleSelect={handleToggleSelect}
      />
    </Box>
  );
};
