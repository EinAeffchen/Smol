import React, { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import {
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useListStore, defaultListState } from "../stores/useListStore";
import { getDuplicates, startDuplicateDetection } from "../services/duplicates";
import { DuplicateGroup } from "../components/DuplicateGroup"; // Our new smart component
import { READ_ONLY } from "../config";

const DuplicatesPage: React.FC = () => {
  const listKey = "duplicate-groups";
  const {
    items: duplicateGroups,
    hasMore,
    isLoading,
  } = useListStore((state) => state.lists[listKey] || defaultListState);
  const { fetchInitial, loadMore, removeItem } = useListStore();
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitial(listKey, () => getDuplicates(null));
  }, [fetchInitial, listKey]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(listKey, (cursor) => getDuplicates(cursor));
    }
  }, [inView, hasMore, isLoading, loadMore, listKey]);

  // This handler will be passed down to remove a whole group from the UI once it's resolved
  const handleGroupResolved = (groupId: number) => {
    removeItem(listKey, groupId);
  };

  const handleStartDetection = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await startDuplicateDetection();
      alert(
        "Duplicate detection started in the background. Please refresh the page in a few minutes."
      );
      // Optionally, you could poll the task status here
    } catch (err) {
      setError("Failed to start duplicate detection task.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: "1600px", mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Potential Duplicates
      </Typography>

      {!READ_ONLY && (
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            onClick={handleStartDetection}
            disabled={isProcessing || isLoading}
          >
            {isProcessing ? (
              <CircularProgress size={24} />
            ) : (
              "Start Duplicate Detection"
            )}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            This will run a background task to find and group duplicates.
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading && duplicateGroups.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : duplicateGroups.length === 0 ? (
        <Typography align="center" sx={{ my: 4 }}>
          No duplicates found.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {duplicateGroups.map(
            (group) =>
              group.items.length > 1 && (
                <DuplicateGroup
                  key={group.group_id}
                  group={group}
                  onGroupResolved={() => handleGroupResolved(group.group_id)}
                />
              )
          )}
          {hasMore && <Box ref={loaderRef} sx={{ height: "1px" }} />}
        </Box>
      )}
    </Box>
  );
};

export default DuplicatesPage;
