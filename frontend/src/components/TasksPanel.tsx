import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import { Task, TaskType } from "../types";
import { getActiveTasks, startTask as startTaskService, cancelTask as cancelTaskService } from "../services/taskActions";

import SyncIcon from "@mui/icons-material/Sync";
import MovieIcon from "@mui/icons-material/Movie";
import Diversity3Icon from "@mui/icons-material/Diversity3";

type TaskLabels = Record<TaskType, string>;
const TASK_LABELS: TaskLabels = {
  scan: "Scan Folder",
  process_media: "Process Media",
  cluster_persons: "Cluster Persons",
  find_duplicates: "find_duplicates",
};

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = async () => {
    try {
      const data = await getActiveTasks();
      setTasks(data);
    } catch (err) {
      console.error("Could not load tasks:", err);
    }
  };

  const startTask = async (type: TaskType) => {
    try {
      await startTaskService(type);
      await fetchTasks();
    } catch (err) {
      console.error("Error starting task", type, err);
    }
  };

  const cancelTask = async (id: string) => {
    try {
      await cancelTaskService(id);
      fetchTasks();
    } catch (err) {
      console.error("Error cancelling task", id, err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const iv = setInterval(fetchTasks, 2000);
    return () => clearInterval(iv);
  }, []);

  const isTaskRunning = (type: TaskType) =>
    tasks.some((t) => t.task_type === type && t.status === "running");

  return (
    <Box>
      {/* Active Tasks Section */}
      {tasks.length > 0 && (
        <Stack spacing={2} mb={2}>
          <Typography variant="overline" color="text.secondary">
            Active Tasks
          </Typography>
          {tasks.map((t) => {
            const pct =
              t.total > 0
                ? Math.round((t.processed / t.total) * 100)
                : t.status === "completed"
                ? 100
                : 0;
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
                    {t.status === "running" && ` (${pct}%)`}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    mt: 0.5,
                    bgcolor: "divider",
                    "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
                  }}
                />
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
      </List>
    </Box>
  );
}
