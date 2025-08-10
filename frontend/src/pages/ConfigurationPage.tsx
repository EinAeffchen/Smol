import React, { useEffect, useState } from "react";
import { getConfig, saveConfig } from "../services/config";
import { AppConfig } from "../types";
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
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await getConfig();
        setConfig(data);
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
      await saveConfig(config);
      setSnackbar({ open: true, message: "Configuration saved successfully!", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : "An unknown error occurred.", severity: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValueChange = <T extends keyof AppConfig, K extends keyof AppConfig[T]>(
    section: T,
    key: K,
    value: AppConfig[T][K]
  ) => {
    if (config) {
      setConfig({ ...config, [section]: { ...config[section], [key]: value } });
    }
  };

  const handleClipModelChange = (event: React.ChangeEvent<{ value: unknown }>) => {
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

  if (isLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
  }

  if (error && !config) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!config) {
    return <Typography>No configuration loaded.</Typography>;
  }

  const sections: { label: string; content: React.ReactNode }[] = [
    {
      label: "General",
      content: (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Port" value={config.general.port} onChange={(e) => handleValueChange("general", "port", parseInt(e.target.value))} fullWidth margin="normal" type="number" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Domain" value={config.general.domain} onChange={(e) => handleValueChange("general", "domain", e.target.value)} fullWidth margin="normal" />
          </Grid>
          <Grid item xs={12}>
            <FormGroup>
              <FormControlLabel control={<Switch checked={config.general.read_only} onChange={(e) => handleValueChange("general", "read_only", e.target.checked)} />} label="Read Only" />
              <FormControlLabel control={<Switch checked={config.general.enable_people} onChange={(e) => handleValueChange("general", "enable_people", e.target.checked)} />} label="Enable People" />
            </FormGroup>
          </Grid>
        </Grid>
      ),
    },
    {
      label: "Scan",
      content: (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Scan Interval (minutes)" value={config.scan.scan_interval_minutes} onChange={(e) => handleValueChange("scan", "scan_interval_minutes", parseInt(e.target.value))} fullWidth margin="normal" type="number" />
          </Grid>
          <Grid item xs={12}>
            <FormGroup>
              <FormControlLabel control={<Switch checked={config.scan.auto_scan} onChange={(e) => handleValueChange("scan", "auto_scan", e.target.checked)} />} label="Auto Scan" />
              <FormControlLabel control={<Switch checked={config.scan.auto_clean_on_scan} onChange={(e) => handleValueChange("scan", "auto_clean_on_scan", e.target.checked)} />} label="Auto Clean on Scan" />
              <FormControlLabel control={<Switch checked={config.scan.auto_cluster_on_scan} onChange={(e) => handleValueChange("scan", "auto_cluster_on_scan", e.target.checked)} />} label="Auto Cluster on Scan" />
              <FormControlLabel control={<Switch checked={config.scan.auto_rotate} onChange={(e) => handleValueChange("scan", "auto_rotate", e.target.checked)} />} label="Auto Rotate" />
            </FormGroup>
          </Grid>
        </Grid>
      ),
    },
    {
        label: "AI",
        content: (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
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
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Min Search Distance" value={config.ai.min_search_dist} onChange={(e) => handleValueChange("ai", "min_search_dist", parseFloat(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Min Similarity Distance" value={config.ai.min_similarity_dist} onChange={(e) => handleValueChange("ai", "min_similarity_dist", parseFloat(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
            </Grid>
        )
    },
    {
        label: "Tagging",
        content: (
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <TextField label="Custom Tags" value={config.tagging.custom_tags.join(",")} onChange={(e) => handleValueChange("tagging", "custom_tags", e.target.value.split(","))} fullWidth margin="normal" helperText="Comma-separated list of tags" />
                </Grid>
                <Grid item xs={12}>
                    <FormGroup>
                        <FormControlLabel control={<Switch checked={config.tagging.auto_tagging} onChange={(e) => handleValueChange("tagging", "auto_tagging", e.target.checked)} />} label="Auto Tagging" />
                        <FormControlLabel control={<Switch checked={config.tagging.use_default_tags} onChange={(e) => handleValueChange("tagging", "use_default_tags", e.target.checked)} />} label="Use Default Tags" />
                    </FormGroup>
                </Grid>
            </Grid>
        )
    },
    {
        label: "Face Recognition",
        content: (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField label="Min Confidence" value={config.face_recognition.face_recognition_min_confidence} onChange={(e) => handleValueChange("face_recognition", "face_recognition_min_confidence", parseFloat(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Match Cosine Threshold" value={config.face_recognition.face_match_cosine_threshold} onChange={(e) => handleValueChange("face_recognition", "face_match_cosine_threshold", parseFloat(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Min Face Pixels" value={config.face_recognition.face_recognition_min_face_pixels} onChange={(e) => handleValueChange("face_recognition", "face_recognition_min_face_pixels", parseInt(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Min Face Count per Person" value={config.face_recognition.person_min_face_count} onChange={(e) => handleValueChange("face_recognition", "person_min_face_count", parseInt(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
            </Grid>
        )
    },
    {
        label: "Duplicates",
        content: (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField label="Auto Handling" value={config.duplicates.duplicate_auto_handling} onChange={(e) => handleValueChange("duplicates", "duplicate_auto_handling", e.target.value)} fullWidth margin="normal" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Auto Keep Rule" value={config.duplicates.duplicate_auto_keep_rule} onChange={(e) => handleValueChange("duplicates", "duplicate_auto_keep_rule", e.target.value)} fullWidth margin="normal" />
                </Grid>
            </Grid>
        )
    },
    {
        label: "Video",
        content: (
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField label="Max Frames per Video" value={config.video.max_frames_per_video} onChange={(e) => handleValueChange("video", "max_frames_per_video", parseInt(e.target.value))} fullWidth margin="normal" type="number" />
                </Grid>
                <Grid item xs={12}>
                    <FormGroup>
                        <FormControlLabel control={<Switch checked={config.video.auto_scene_detection} onChange={(e) => handleValueChange("video", "auto_scene_detection", e.target.checked)} />} label="Auto Scene Detection" />
                    </FormGroup>
                </Grid>
            </Grid>
        )
    },
    {
        label: "Processors",
        content: (
            <FormGroup>
                <FormControlLabel control={<Switch checked={config.processors.exif_processor_active} onChange={(e) => handleValueChange("processors", "exif_processor_active", e.target.checked)} />} label="EXIF Processor" />
                <FormControlLabel control={<Switch checked={config.processors.face_processor_active} onChange={(e) => handleValueChange("processors", "face_processor_active", e.target.checked)} />} label="Face Processor" />
                <FormControlLabel control={<Switch checked={config.processors.image_embedding_processor_active} onChange={(e) => handleValueChange("processors", "image_embedding_processor_active", e.target.checked)} />} label="Image Embedding Processor" />
            </FormGroup>
        )
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>Configuration</Typography>
      <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex' }}>
        <Tabs
          orientation="vertical"
          variant="scrollable"
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Vertical tabs example"
          sx={{ borderRight: 1, borderColor: 'divider' }}
        >
          {sections.map((section, index) => <Tab key={index} label={section.label} />)}
        </Tabs>
        {sections.map((section, index) => (
          <TabPanel key={index} value={tabValue} index={index}>
            {section.content}
          </TabPanel>
        ))}
      </Box>
      <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" color="primary" onClick={handleSave} disabled={isSaving} size="large">
          {isSaving ? <CircularProgress size={24} color="inherit" /> : "Save"}
        </Button>
      </Box>
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}