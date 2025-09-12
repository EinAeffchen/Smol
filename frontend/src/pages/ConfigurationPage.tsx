import React, { useEffect, useState } from "react";
import {
  getConfig,
  saveConfig,
  reloadConfig,
  pickDirectory,
  listProfiles,
  createProfile as apiCreateProfile,
  switchProfile as apiSwitchProfile,
  removeProfile as apiRemoveProfile,
  getProfileHealth,
} from "../services/config";
import { AppConfig, ProfileListResponse } from "../types";
import { IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { addExistingProfile } from "../services/config";
import {
  Button,
  Container,
  Typography,
  CircularProgress,
  Snackbar,
  TextField,
  Switch,
  FormGroup,
  FormControlLabel,
  Grid,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Alert,
  FormHelperText,
  Radio,
} from "@mui/material";

const clipModels = [
  {
    name: "xlm-roberta-large-ViT-H-14",
    value: "('xlm-roberta-large-ViT-H-14', 1024, 'frozen_laion5b_s13b_b90k')",
    embeddingSize: 1024,
    pretrained: "frozen_laion5b_s13b_b90k",
  },
  {
    name: "xlm-roberta-base-ViT-B-32",
    value: "('xlm-roberta-base-ViT-B-32', 512, 'laion5b_s13b_b90k')",
    embeddingSize: 512,
    pretrained: "laion5b_s13b_b90k",
  },
  {
    name: "ViT-L-14",
    value: "('ViT-L-14', 768, 'laion2b_s32b_b82k')",
    embeddingSize: 768,
    pretrained: "laion2b_s32b_b82k",
  },
  {
    name: "ViT-B-32",
    value: "('ViT-B-32', 512, 'laion2b_s34b_b79k')",
    embeddingSize: 512,
    pretrained: "laion2b_s34b_b79k",
  },
  {
    name: "convnext_base_w",
    value: "('convnext_base_w', 640, 'laion2b_s13b_b82k_augreg')",
    embeddingSize: 640,
    pretrained: "laion2b_s13b_b82k_augreg",
  },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
      style={{ width: "100%" }}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ConfigurationPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [tabValue, setTabValue] = useState(0);
  const [profiles, setProfiles] = useState<ProfileListResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [selectedProfilePath, setSelectedProfilePath] = useState<string | null>(
    null
  );
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("My Library");
  const [newProfilePath, setNewProfilePath] = useState("");
  const [profileHealth, setProfileHealth] = useState<
    import("../types").ProfileHealth | null
  >(null);
  const [hasActiveTasks, setHasActiveTasks] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await getConfig();
        setConfig(data);
        // Try to load profiles; ignore errors on Docker
        try {
          const p = await listProfiles();
          setProfiles(p);
          setSelectedProfilePath(p.active_path);
        } catch (e) {
          setProfiles(null);
        }
        // Fetch profile health to detect moved/missing profiles
        try {
          const h = await getProfileHealth();
          setProfileHealth(h);
        } catch {}
        // Check active tasks to gate profile actions
        try {
          const tasks = await (
            await import("../services/taskActions")
          ).getActiveTasks();
          setHasActiveTasks(tasks.length > 0);
        } catch {}
      } catch {
        setError("Failed to load configuration.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const sanitized = {
        ...config,
        general: {
          ...config.general,
          media_dirs: Array.from(
            new Set(
              (config.general.media_dirs ?? [])
                .map((s) => s.trim())
                .filter(Boolean)
            )
          ),
        },
      };

      await saveConfig(sanitized);

      // If a different profile is selected, switch to it as part of Save
      if (
        profiles &&
        selectedProfilePath &&
        selectedProfilePath !== profiles.active_path
      ) {
        setIsSwitchingProfile(true);
        await apiSwitchProfile(selectedProfilePath);
      }

      // Reload backend config and sync frontend runtime flags; also
      // update local state with the authoritative server config.
      const latest = await reloadConfig();
      setConfig(latest);
      await refreshProfiles();

      // If the profile changed, do a full page reload to ensure all pages pull fresh data
      if (
        profiles &&
        selectedProfilePath &&
        selectedProfilePath !== profiles.active_path
      ) {
        try {
          window.location.reload();
        } catch {}
        return; // Unreachable after reload, but keeps intent clear
      }

      setSnackbar({
        open: true,
        message: "Configuration saved and reloaded successfully!",
        severity: "success",
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message:
          err instanceof Error ? err.message : "An unknown error occurred.",
        severity: "error",
      });
    } finally {
      setIsSaving(false);
      setIsSwitchingProfile(false);
    }
  };

  const addMediaDir = async () => {
    if (!config) return;
    const chosen = await pickDirectory();
    const value = chosen || "";
    handleValueChange("general", "media_dirs", [
      ...config.general.media_dirs,
      value,
    ] as any);
  };

  const updateMediaDir = (index: number, value: string) => {
    if (!config) return;
    const next = [...config.general.media_dirs];
    next[index] = value;
    handleValueChange("general", "media_dirs", next as any);
  };

  const removeMediaDir = (index: number) => {
    if (!config) return;
    const next = config.general.media_dirs.filter((_, i) => i !== index);
    handleValueChange("general", "media_dirs", next as any);
  };

  const browseMediaDir = async (index: number) => {
    const path = await pickDirectory();
    if (path && config) {
      updateMediaDir(index, path);
    }
  };

  const handleValueChange = <
    T extends keyof AppConfig,
    K extends keyof AppConfig[T],
  >(
    section: T,
    key: K,
    value: AppConfig[T][K]
  ) => {
    if (config) {
      setConfig({ ...config, [section]: { ...config[section], [key]: value } });
    }
  };
  const handleClipModelChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const selectedName = event.target.value as string;
    const selectedModel = clipModels.find((m) => m.name === selectedName);
    if (selectedModel && config) {
      const newAiConfig = {
        ...config.ai,
        clip_model_enum: selectedModel.name as any, // Send just the name
        clip_model: selectedModel.name,
        clip_model_embedding_size: selectedModel.embeddingSize,
        clip_model_pretrained: selectedModel.pretrained,
      };
      setConfig({ ...config, ai: newAiConfig });
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const refreshProfiles = async () => {
    try {
      const p = await listProfiles();
      setProfiles(p);
      setProfileError(null);
    } catch (e: any) {
      setProfileError(e?.message || "Failed to load profiles");
    }
  };

  const createProfile = async () => {
    if (!newProfilePath) return;
    setCreatingProfile(true);
    try {
      await apiCreateProfile(newProfilePath, newProfileName || "Profile");
      const latest = await reloadConfig();
      setConfig(latest);
      const lp = await listProfiles();
      setProfiles(lp);
      setSelectedProfilePath(lp.active_path);
      setSnackbar({
        open: true,
        message: "Profile created",
        severity: "success",
      });
      setNewProfilePath("");
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message || "Failed to create profile",
        severity: "error",
      });
    } finally {
      setCreatingProfile(false);
    }
  };

  // Switching now happens as part of Save; users select via radio and then Save.

  const removeProfile = async (path: string) => {
    try {
      await apiRemoveProfile(path);
      await refreshProfiles();
      setSnackbar({
        open: true,
        message: "Removed profile",
        severity: "success",
      });
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message || "Failed to remove profile",
        severity: "error",
      });
    }
  };

  const pickNewProfilePath = async () => {
    const p = await pickDirectory();
    if (p) setNewProfilePath(p);
  };

  // Relocate current profile if it was moved manually by selecting new path,
  // then clicking Save (will run switchProfile)
  const pickRelocatePath = async () => {
    const p = await pickDirectory();
    if (p) setSelectedProfilePath(p);
  };
  const handleAddExisting = async () => {
    try {
      const p = await pickDirectory();
      if (!p) return;
      await addExistingProfile(p);
      await refreshProfiles();
      setSelectedProfilePath(p);
      setSnackbar({
        open: true,
        message: "Profile added",
        severity: "success",
      });
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.message || "Failed to add profile",
        severity: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error && !config) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!config) {
    return <Typography>No configuration loaded.</Typography>;
  }

  const isBinary = !!config.general.is_binary;
  let sections: { label: string; content: React.ReactNode }[] = [
    {
      label: "Profiles",
      content: (
        <Grid container spacing={2}>
          {profiles && !config.general.is_docker ? (
            <>
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6">Active Profile</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {profiles.active_path}
                </Typography>
                {profileHealth &&
                  (!profileHealth.active_exists || !profileHealth.has_db) && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      The active profile looks missing or empty. If you moved
                      it, choose the new location and click Save to relink.
                      <Button
                        size="small"
                        sx={{ ml: 2 }}
                        variant="outlined"
                        onClick={pickRelocatePath}
                      >
                        Choose directory…
                      </Button>
                    </Alert>
                  )}
              </Grid>
              {hasActiveTasks && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Processing is active. Profile actions are disabled until
                    tasks finish.
                  </Alert>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  All Profiles
                </Typography>
                <Box sx={{ mb: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={handleAddExisting}
                    disabled={hasActiveTasks}
                  >
                    Add Existing…
                  </Button>
                </Box>
                {(profiles.profiles ?? []).map((p) => (
                  <Box
                    key={p.path}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    <IconButton
                      color="primary"
                      onClick={() => setSelectedProfilePath(p.path)}
                      disabled={hasActiveTasks || isSwitchingProfile}
                    >
                      <Radio checked={selectedProfilePath === p.path} />
                    </IconButton>
                    <TextField
                      label="Name"
                      value={p.name}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                    <TextField
                      label="Path"
                      value={p.path}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                    <IconButton
                      aria-label="remove profile"
                      onClick={() => removeProfile(p.path)}
                      disabled={
                        p.path === profiles.active_path ||
                        hasActiveTasks ||
                        isSwitchingProfile
                      }
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                {profiles &&
                  selectedProfilePath &&
                  selectedProfilePath !== profiles.active_path && (
                    <Typography
                      variant="caption"
                      sx={{ mt: 1, display: "block", color: "text.secondary" }}
                    >
                      Selected profile will become active when you click Save
                      below.
                    </Typography>
                  )}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Create New Profile
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}
                >
                  <TextField
                    label="Name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Directory"
                    value={newProfilePath}
                    onChange={(e) => setNewProfilePath(e.target.value)}
                    fullWidth
                  />
                  <IconButton
                    aria-label="browse"
                    onClick={pickNewProfilePath}
                    disabled={hasActiveTasks}
                  >
                    <FolderOpenIcon />
                  </IconButton>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={!creatingProfile ? <AddIcon /> : undefined}
                    onClick={createProfile}
                    disabled={
                      !newProfilePath || creatingProfile || hasActiveTasks
                    }
                    sx={{ minWidth: 120 }}
                  >
                    {creatingProfile ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </Box>
                <FormHelperText>
                  Destination directory must be empty or non-existent.
                </FormHelperText>
              </Grid>
            </>
          ) : (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                Profiles are not available in this environment.
              </Alert>
            </Grid>
          )}
        </Grid>
      ),
    },
    {
      label: "General",
      content: (
        <Grid container spacing={2}>
          {!isBinary && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Port"
                  value={config.general.port}
                  onChange={(e) =>
                    handleValueChange(
                      "general",
                      "port",
                      parseInt(e.target.value)
                    )
                  }
                  fullWidth
                  margin="normal"
                  type="number"
                  helperText="HTTP port for the API/UI server (requires restart if running manually)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Domain"
                  value={config.general.domain}
                  onChange={(e) =>
                    handleValueChange("general", "domain", e.target.value)
                  }
                  fullWidth
                  margin="normal"
                  helperText="Base URL used for generating links and API calls"
                />
              </Grid>
            </>
          )}
          {isBinary && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Media Directories
              </Typography>

              {(config.general.media_dirs ?? []).map((dir, idx) => (
                <Box
                  key={idx}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <TextField
                    fullWidth
                    margin="normal"
                    label={`Media directory #${idx + 1}`}
                    value={dir}
                    onChange={(e) => updateMediaDir(idx, e.target.value)}
                    helperText="Absolute path."
                  />
                  <IconButton
                    aria-label="browse for media directory"
                    onClick={() => browseMediaDir(idx)}
                    size="large"
                  >
                    <FolderOpenIcon />
                  </IconButton>
                  <IconButton
                    aria-label="remove media directory"
                    onClick={() => removeMediaDir(idx)}
                    size="large"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}

              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                onClick={addMediaDir}
                sx={{ mt: 1 }}
              >
                Add directory
              </Button>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.general.read_only}
                    onChange={(e) =>
                      handleValueChange(
                        "general",
                        "read_only",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Read Only"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Prevents writes: no deletes/moves or DB changes. Safe viewing
                mode.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.general.enable_people}
                    onChange={(e) =>
                      handleValueChange(
                        "general",
                        "enable_people",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Enable People"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Enables face detection, recognition, and person clustering
                features.
              </Typography>
            </FormGroup>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Thumbs per Folder"
              value={config.general.thumb_dir_folder_size}
              onChange={(e) =>
                handleValueChange(
                  "general",
                  "thumb_dir_folder_size",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Max thumbnails per subfolder (tune for filesystem inode limits)"
            />
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Scan",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Scan Interval (minutes)"
              value={config.scan.scan_interval_minutes}
              onChange={(e) =>
                handleValueChange(
                  "scan",
                  "scan_interval_minutes",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="How often to look for new/changed files when Auto Scan is on"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.scan.auto_scan}
                    onChange={(e) =>
                      handleValueChange("scan", "auto_scan", e.target.checked)
                    }
                  />
                }
                label="Auto Scan"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Periodically scans media directories in the background.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.scan.auto_clean_on_scan}
                    onChange={(e) =>
                      handleValueChange(
                        "scan",
                        "auto_clean_on_scan",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto Clean on Scan"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Removes database records for files that no longer exist on disk.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.scan.auto_cluster_on_scan}
                    onChange={(e) =>
                      handleValueChange(
                        "scan",
                        "auto_cluster_on_scan",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto Cluster on Scan"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Automatically clusters new faces into persons after each scan.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.scan.auto_rotate}
                    onChange={(e) =>
                      handleValueChange("scan", "auto_rotate", e.target.checked)
                    }
                  />
                }
                label="Auto Rotate"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Applies EXIF orientation to files and normalizes rotation.
              </Typography>
            </FormGroup>
          </Grid>
        </Grid>
      ),
    },
    {
      label: "AI",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="clip-model-select-label">Clip Model</InputLabel>
              <Select
                labelId="clip-model-select-label"
                value={config.ai.clip_model} // Bind to the model name
                label="Clip Model"
                onChange={handleClipModelChange as any}
              >
                {clipModels.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Larger models improve accuracy but require more memory/CPU.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Min Search Distance"
              value={config.ai.min_search_dist}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "min_search_dist",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Higher = stricter similarity for search (fewer, more accurate results)"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Min Similarity Distance"
              value={config.ai.min_similarity_dist}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "min_similarity_dist",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Higher = stronger match needed to count media as similar"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Cluster Batch Size"
              value={config.ai.cluster_batch_size}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "cluster_batch_size",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Faces processed per clustering batch (memory vs. speed)"
            />
          </Grid>

          {/* HDBSCAN advanced clustering parameters */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="HDBSCAN Min Cluster Size"
              value={config.ai.hdbscan_min_cluster_size}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "hdbscan_min_cluster_size",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Minimum faces to form a cluster; larger merges clusters (fewer small identities)."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="HDBSCAN Min Samples"
              value={config.ai.hdbscan_min_samples}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "hdbscan_min_samples",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Higher = more conservative (more points marked as noise/outliers)."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="hdbscan-cluster-selection-method-label">
                HDBSCAN Cluster Selection Method
              </InputLabel>
              <Select
                labelId="hdbscan-cluster-selection-method-label"
                value={config.ai.hdbscan_cluster_selection_method}
                label="HDBSCAN Cluster Selection Method"
                onChange={(e) =>
                  handleValueChange(
                    "ai",
                    "hdbscan_cluster_selection_method",
                    e.target.value as any
                  )
                }
              >
                <MenuItem value="leaf">
                  leaf (finer, more granular clusters)
                </MenuItem>
                <MenuItem value="eom">eom (more stable, fewer splits)</MenuItem>
              </Select>
              <FormHelperText>
                Controls granularity of clusters; "leaf" yields finer
                segmentation.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="HDBSCAN Cluster Selection Epsilon"
              value={config.ai.hdbscan_cluster_selection_epsilon}
              onChange={(e) =>
                handleValueChange(
                  "ai",
                  "hdbscan_cluster_selection_epsilon",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              inputProps={{ step: 0.01 }}
              helperText="Extra split sensitivity; larger values produce more, smaller clusters."
            />
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Tagging",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Custom Tags"
              value={config.tagging.custom_tags.join(",")}
              onChange={(e) =>
                handleValueChange(
                  "tagging",
                  "custom_tags",
                  e.target.value.split(",")
                )
              }
              fullWidth
              margin="normal"
              helperText="Comma-separated list of tags"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.tagging.auto_tagging}
                    onChange={(e) =>
                      handleValueChange(
                        "tagging",
                        "auto_tagging",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto Tagging"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Uses the CLIP model to generate descriptive tags for media.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.tagging.use_default_tags}
                    onChange={(e) =>
                      handleValueChange(
                        "tagging",
                        "use_default_tags",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Use Default Tags"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Includes a curated set of common tags alongside your custom
                list.
              </Typography>
            </FormGroup>
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Face Recognition",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Min Confidence"
              value={config.face_recognition.face_recognition_min_confidence}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "face_recognition_min_confidence",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Lower = detect more faces (including low-quality), higher = stricter"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Match Cosine Threshold"
              value={config.face_recognition.face_match_cosine_threshold}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "face_match_cosine_threshold",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Similarity threshold for attaching a face to a known person"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Existing Person Cosine Threshold"
              value={config.face_recognition.existing_person_cosine_threshold}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "existing_person_cosine_threshold",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Stricter threshold when attaching to already-established persons"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Existing Person Min Cosine Margin"
              value={config.face_recognition.existing_person_min_cosine_margin}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "existing_person_min_cosine_margin",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              inputProps={{ step: 0.01 }}
              helperText="Require a gap between best and 2nd-best match to avoid ambiguity"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Existing Person Min Appearances"
              value={config.face_recognition.existing_person_min_appearances}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "existing_person_min_appearances",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Do not attach to very small/immature persons (reduces noise)"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Min Face Pixels"
              value={config.face_recognition.face_recognition_min_face_pixels}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "face_recognition_min_face_pixels",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Minimum face area (in pixels) to be considered detectible"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Min Face Count per Person"
              value={config.face_recognition.person_min_face_count}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "person_min_face_count",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Faces required to automatically create a new person"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Person Cluster Max L2 Radius"
              value={config.face_recognition.person_cluster_max_l2_radius}
              onChange={(e) =>
                handleValueChange(
                  "face_recognition",
                  "person_cluster_max_l2_radius",
                  parseFloat(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              inputProps={{ step: 0.01 }}
              helperText="Max allowed L2 distance around centroid when forming a new person"
            />
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Duplicates",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="dup-auto-handling-label">
                Auto Handling
              </InputLabel>
              <Select
                labelId="dup-auto-handling-label"
                value={config.duplicates.duplicate_auto_handling}
                label="Auto Handling"
                onChange={(e) =>
                  handleValueChange(
                    "duplicates",
                    "duplicate_auto_handling",
                    e.target.value as any
                  )
                }
              >
                <MenuItem value="keep">
                  keep (do nothing automatically)
                </MenuItem>
                <MenuItem value="remove">
                  remove (resolve without deleting files)
                </MenuItem>
                <MenuItem value="blacklist">blacklist duplicates</MenuItem>
                <MenuItem value="delete">delete duplicates</MenuItem>
              </Select>
              <FormHelperText>
                Automatic action when duplicates are found. "keep" is the safest
                default.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="dup-keep-rule-label">Auto Keep Rule</InputLabel>
              <Select
                labelId="dup-keep-rule-label"
                value={config.duplicates.duplicate_auto_keep_rule}
                label="Auto Keep Rule"
                onChange={(e) =>
                  handleValueChange(
                    "duplicates",
                    "duplicate_auto_keep_rule",
                    e.target.value as any
                  )
                }
              >
                <MenuItem value="biggest">biggest file size</MenuItem>
                <MenuItem value="smallest">smallest file size</MenuItem>
                <MenuItem value="highest_res">highest resolution</MenuItem>
                <MenuItem value="lowest_res">lowest resolution</MenuItem>
                <MenuItem value="oldest">oldest file date</MenuItem>
                <MenuItem value="newest">newest file date</MenuItem>
              </Select>
              <FormHelperText>
                Which file to keep when auto-handling duplicates is enabled.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Video",
      content: (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Max Frames per Video"
              value={config.video.max_frames_per_video}
              onChange={(e) =>
                handleValueChange(
                  "video",
                  "max_frames_per_video",
                  parseInt(e.target.value)
                )
              }
              fullWidth
              margin="normal"
              type="number"
              helperText="Fallback frame sampling count when scene detection fails"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.video.auto_scene_detection}
                    onChange={(e) =>
                      handleValueChange(
                        "video",
                        "auto_scene_detection",
                        e.target.checked
                      )
                    }
                  />
                }
                label="Auto Scene Detection"
              />
              <Typography
                variant="caption"
                sx={{ ml: 6, mt: -1, display: "block" }}
              >
                Detects scene changes and uses those frames for thumbnails and
                search.
              </Typography>
            </FormGroup>
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Processors",
      content: (
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={config.processors.exif_processor_active}
                onChange={(e) =>
                  handleValueChange(
                    "processors",
                    "exif_processor_active",
                    e.target.checked
                  )
                }
              />
            }
            label="EXIF Processor"
          />
          <Typography
            variant="caption"
            sx={{ ml: 6, mt: -1, display: "block" }}
          >
            Extracts date, camera, GPS and other metadata for search & maps.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={config.processors.face_processor_active}
                onChange={(e) =>
                  handleValueChange(
                    "processors",
                    "face_processor_active",
                    e.target.checked
                  )
                }
              />
            }
            label="Face Processor"
          />
          <Typography
            variant="caption"
            sx={{ ml: 6, mt: -1, display: "block" }}
          >
            Detects faces in images and prepares them for recognition.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={config.processors.image_embedding_processor_active}
                onChange={(e) =>
                  handleValueChange(
                    "processors",
                    "image_embedding_processor_active",
                    e.target.checked
                  )
                }
              />
            }
            label="Image Embedding Processor"
          />
          <Typography
            variant="caption"
            sx={{ ml: 6, mt: -1, display: "block" }}
          >
            Generates CLIP embeddings for search, similarity, and related
            content.
          </Typography>
        </FormGroup>
      ),
    },
  ];

  if (config.general.is_docker) {
    // Hide the Profiles tab entirely in Docker environments
    sections = sections.filter((s) => s.label !== "Profiles");
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Configuration
      </Typography>
      <Box sx={{ flexGrow: 1, bgcolor: "background.paper", display: "flex" }}>
        <Tabs
          orientation="vertical"
          variant="scrollable"
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Vertical tabs example"
          sx={{ borderRight: 1, borderColor: "divider" }}
        >
          {sections.map((section, index) => (
            <Tab key={index} label={section.label} />
          ))}
        </Tabs>
        {sections.map((section, index) => (
          <TabPanel key={index} value={tabValue} index={index}>
            {section.content}
          </TabPanel>
        ))}
      </Box>
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isSaving}
          size="large"
        >
          {isSaving ? <CircularProgress size={24} color="inherit" /> : "Save"}
        </Button>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
