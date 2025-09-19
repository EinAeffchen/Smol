import React, { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import {
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useListStore, defaultListState } from "../stores/useListStore";
import { getDuplicates } from "../services/duplicates";
import { DuplicateGroup } from "../components/DuplicateGroup"; // Our new smart component
import { useTaskCompletionVersion, useTaskEvents } from "../TaskEventsContext";

const DuplicatesPage: React.FC = () => {
  const listKey = "duplicate-groups";
  const {
    items: duplicateGroups,
    hasMore,
    isLoading,
  } = useListStore((state) => state.lists[listKey] || defaultListState);
  const { fetchInitial, loadMore, removeItem, clearList } = useListStore();
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });
  const refreshKey = useTaskCompletionVersion(["find_duplicates"]);
  const { activeTasks } = useTaskEvents();
  const duplicateTask = activeTasks.find(
    (task) => task.task_type === "find_duplicates"
  );

  useEffect(() => {
    clearList(listKey);
    fetchInitial(listKey, () => getDuplicates(null));
  }, [fetchInitial, listKey, clearList, refreshKey]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(listKey, (cursor) => getDuplicates(cursor));
    }
  }, [inView, hasMore, isLoading, loadMore, listKey]);

  // This handler will be passed down to remove a whole group from the UI once it's resolved
  const handleGroupResolved = (groupId: number) => {
    removeItem(listKey, groupId);
  };

  return (
    <Box sx={{ p: 2, maxWidth: "1600px", mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        Potential Duplicates
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Start duplicate detection from the control panel in the header; progress
        is tracked there and this list refreshes when a run completes.
      </Alert>

      {duplicateTask && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Duplicate detection running… {duplicateTask.processed}/{duplicateTask.total}
          {duplicateTask.current_step ? ` (${duplicateTask.current_step})` : ""}
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
