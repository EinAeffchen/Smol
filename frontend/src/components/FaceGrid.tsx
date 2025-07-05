import React from "react";
import { Box } from "@mui/material";
import FaceCard from "./FaceCard";
import { FaceRead } from "../types";

interface FaceGridProps {
  faces: FaceRead[];
  selectedFaceIds: number[];
  onToggleSelect: (faceId: number) => void;
}

export const FaceGrid: React.FC<FaceGridProps> = ({
  faces,
  selectedFaceIds,
  onToggleSelect,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2, // Consistent spacing
        justifyContent: "flex-start",
      }}
    >
      {faces.map((face) => (
        <FaceCard
          key={face.id}
          face={face}
          isProfile={false} // Orphans can't be profile pics
          selected={selectedFaceIds.includes(face.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </Box>
  );
};
