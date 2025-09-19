import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import { TaskType } from "../types";
import { startTask as startTaskService, cancelTask as cancelTaskService } from "../services/taskActions";
import { useTaskEvents } from "../TaskEventsContext";

import SyncIcon from "@mui/icons-material/Sync";
import MovieIcon from "@mui/icons-material/Movie";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

type TaskLabels = Record<TaskType, string>;
const TASK_LABELS: TaskLabels = {
  scan: "Scan Folder",
  process_media: "Process Media",
  clean_missing_files: "Cleanup missing files",
  cluster_persons: "Cluster Persons",
  find_duplicates: "Find duplicates",
};

export default function TaskManager() {
  const { activeTasks, forceRefresh } = useTaskEvents();
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({ open: false, msg: "", sev: "success" });
  // Track when each task last made progress to enable an indeterminate fallback
  const lastProgressRef = useRef<Record<string, { processed: number; changedAt: number }>>({});

  useEffect(() => {
    const now = Date.now();
    const nextMap: Record<string, { processed: number; changedAt: number }> = {
      ...lastProgressRef.current,
    };

    activeTasks.forEach((t) => {
      const prev = nextMap[t.id];
      if (!prev || prev.processed !== t.processed) {
        nextMap[t.id] = { processed: t.processed, changedAt: now };
      }
    });

    const activeIds = new Set(activeTasks.map((t) => t.id));
    Object.keys(nextMap).forEach((id) => {
      if (!activeIds.has(id)) {
        delete nextMap[id];
      }
    });

    lastProgressRef.current = nextMap;
  }, [activeTasks]);

  const startTask = async (type: TaskType) => {
    try {
      await startTaskService(type);
      await forceRefresh();
      setSnack({ open: true, msg: `${TASK_LABELS[type]} started`, sev: "success" });
    } catch (err: any) {
      console.error("Error starting task", type, err);
      const msg = err?.message || "Failed to start task";
      setSnack({ open: true, msg, sev: "error" });
    }
  };

  const cancelTask = async (id: string) => {
    try {
      await cancelTaskService(id);
      await forceRefresh();
    } catch (err) {
      console.error("Error cancelling task", id, err);
    }
  };

  const isTaskRunning = (type: TaskType) =>
    activeTasks.some((t) => t.task_type === type && (t.status === "running" || t.status === "pending"));

  return (
    <Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.msg}
        </Alert>
      </Snackbar>
      {/* Active Tasks Section */}
      {activeTasks.length > 0 && (
        <Stack spacing={2} mb={2}>
          <Typography variant="overline" color="text.secondary">
            Active Tasks
          </Typography>
          {activeTasks.map((t) => {
            const pct =
              t.total > 0
                ? Math.round((t.processed / t.total) * 100)
                : t.status === "completed"
                ? 100
                : 0;
            const lp = lastProgressRef.current[t.id];
            const staleForMs = lp ? Date.now() - lp.changedAt : Number.POSITIVE_INFINITY;
            // If we haven't seen progress in a bit (e.g., long video/scenes/model load),
            // switch to an indeterminate bar to show activity.
            const showIndeterminate =
              t.status === "running" && (t.total === 0 || staleForMs > 8000);
            return (
              <Box key={t.id}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="body2" fontWeight="bold">
                    {TASK_LABELS[t.task_type]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.status}
                    {t.status === "running" && ` (${pct}% - ${t.processed}/${t.total})`}
                  </Typography>
                </Box>
                <LinearProgress
                  variant={showIndeterminate ? "indeterminate" : "determinate"}
                  value={showIndeterminate ? undefined : pct}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    mt: 0.5,
                    bgcolor: "divider",
                    "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
                  }}
                />
                {t.status === "running" && (
                  <Typography variant="caption" color="text.secondary">
                    {t.current_step ? `Step: ${t.current_step}` : showIndeterminate ? "Working…" : ""}
                    {t.current_item ? `  —  ${t.current_item}` : ""}
                  </Typography>
                )}
                {t.status === "running" && (
                  <Button
                    size="small"
                    onClick={() => cancelTask(t.id)}
                    sx={{ mt: 0.5, ml: -1, color: "text.secondary" }}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <Divider sx={{ my: 2 }} />

      <List>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => startTask("scan")}
            disabled={isTaskRunning("scan")}
          >
            <ListItemIcon>
              <SyncIcon />
            </ListItemIcon>
            <ListItemText primary="Scan Media Folder" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => startTask("clean_missing_files")}
            disabled={isTaskRunning("clean_missing_files")}
          >
            <ListItemIcon>
              <CleaningServicesIcon />
            </ListItemIcon>
            <ListItemText primary="Clean missing files" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => startTask("process_media")}
            disabled={isTaskRunning("process_media")}
          >
            <ListItemIcon>
              <MovieIcon />
            </ListItemIcon>
            <ListItemText primary="Process New Media" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => startTask("cluster_persons")}
            disabled={isTaskRunning("cluster_persons")}
          >
            <ListItemIcon>
              <Diversity3Icon />
            </ListItemIcon>
            <ListItemText primary="Cluster All Persons" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => startTask("find_duplicates")}
            disabled={isTaskRunning("find_duplicates")}
          >
            <ListItemIcon>
              <ContentCopyIcon />
            </ListItemIcon>
            <ListItemText primary="Find Duplicates" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}
