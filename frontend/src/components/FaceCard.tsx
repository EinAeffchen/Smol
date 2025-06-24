import DeleteIcon from "@mui/icons-material/Delete";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import StarIcon from "@mui/icons-material/Star";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme, // Import useTheme to access theme properties
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link } from "react-router-dom";
import { API, READ_ONLY } from "../config";
import { Face, Person, FaceRead } from "../types";
import { useNavigate, useLocation } from "react-router-dom";

interface FaceCardProps {
  face: Face;
  isProfile: boolean;
  onSetProfile: (faceId: number) => void;
  onAssign: (personId: number) => void;
  onCreate: (data: { name?: string }) => void;
  onDelete: () => void;
  onDetach: () => void;
}

export default function FaceCard({
  face,
  isProfile,
  onSetProfile,
  onAssign,
  onCreate,
  onDelete,
  onDetach,
}: FaceCardProps) {
  const thumbUrl = `${API}/thumbnails/${face.thumbnail_path}`;

  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<"none" | "search" | "new">("none");
  const cardRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const theme = useTheme(); // Get access to the theme object

  const [cands, setCands] = useState<Person[]>([]);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "" });

  useEffect(() => {
    if (mode !== "search" || !query.trim()) {
      setCands([]);
      return;
    }
    fetch(`${API}/api/persons/?name=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((r) => setCands(r.items))
      .catch(console.error);
  }, [mode, query]);

  useEffect(() => {
    if (mode !== "none" && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [mode]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/medium/${face.media_id}`, {
      state: {
        backgroundLocation: location,
      },
    });
  };

  const handleSetProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSetProfile) {
      onSetProfile(face.id);
    }
  };

  const renderDropdownContent = () => {
    if (!dropdownPosition) return null;

    const commonBoxSx = {
      position: "absolute" as "absolute",
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,
      bgcolor: "background.paper",
      boxShadow: theme.shadows[8], // Use theme's shadow
      borderRadius: 2,
      p: 1,
      zIndex: theme.zIndex.modal + 1,
      color: "text.primary",
    };

    if (mode === "search") {
      return (
        <Box sx={commonBoxSx}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Replaced hardcoded TextField styles with theme values
            sx={{
              mb: 1,
              "& .MuiOutlinedInput-root": {
                fieldset: { borderColor: "divider" },
                "&:hover fieldset": { borderColor: "text.secondary" },
                "&.Mui-focused fieldset": { borderColor: "primary.main" },
              },
            }}
          />
          <Box sx={{ maxHeight: 150, overflowY: "auto" }}>
            {cands.length > 0 ? (
              cands.map((p) => (
                <Box
                  key={p.id}
                  onClick={() => assignTo(p.id)}
                  sx={{
                    px: 1,
                    py: 0.5,
                    display: "flex",
                    alignItems: "center",
                    cursor: assigningId ? "not-allowed" : "pointer",
                    opacity: assigningId && assigningId !== p.id ? 0.5 : 1,
                    "&:hover": {
                      bgcolor: assigningId ? "inherit" : "action.hover",
                    },
                    borderRadius: 1,
                  }}
                >
                  {p.name || "Unknown"}
                  {assigningId === p.id && (
                    <CircularProgress
                      size={14}
                      sx={{ ml: 1 }}
                      color="primary"
                    />
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                {query.trim() ? "No matches" : "Type to search"}
              </Typography>
            )}
          </Box>
        </Box>
      );
    }

    if (mode === "new") {
      return (
        <Box sx={commonBoxSx}>
          {["name"].map((field) => (
            <TextField
              key={field}
              name={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              size="small"
              fullWidth
              autoFocus={field === "name"}
              value={(form as any)[field]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [field]: e.target.value }))
              }
              sx={{
                mb: 1,
                "& .MuiOutlinedInput-root": {
                  fieldset: { borderColor: "divider" },
                  "&:hover fieldset": { borderColor: "text.secondary" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                },
              }}
            />
          ))}
          <Button
            size="small"
            fullWidth
            onClick={createAssign}
            variant="contained"
            disabled={creating}
            color="secondary"
            sx={{ mt: 1, color: "white" }}
          >
            {creating ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Create & Assign"
            )}
          </Button>
        </Box>
      );
    }
    return null;
  };

  async function assignTo(pid: number) {
    if (assigningId !== null) return;
    setAssigningId(pid);
    try {
      await onAssign(pid);
    } finally {
      setAssigningId(null);
    }
  }

  async function createAssign() {
    if (creating) return;
    setCreating(true);
    const payload: any = {};
    if (form.name) payload.name = form.name;
    try {
      await onCreate(payload);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Card
        elevation={2}
        ref={cardRef}
        sx={{
          width: 130,
          bgcolor: "background.paper",
          color: "text.primary",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          zIndex: mode !== "none" ? (theme) => theme.zIndex.modal : "auto",
          "&:hover .hover-actions": { opacity: 1 },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <Avatar
            src={`${API}/thumbnails/${face.thumbnail_path}`}
            variant="rounded"
            sx={{
              width: "100%",
              height: 124,
              border: isProfile ? "3px solid" : "none",
              borderColor: "accent.main",
            }}
            onClick={handleCardClick}
          />
          {!READ_ONLY && (
            <Box
              className="hover-actions"
              sx={{
                position: "absolute",
                top: 4,
                left: 4,
                right: 4,
                display: "flex",
                justifyContent: "space-between",
                opacity: 0,
                transition: "opacity 0.3s",
              }}
            >
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  sx={{
                    bgcolor: "rgba(0,0,0,0.4)",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                  }}
                  onClick={onDelete}
                >
                  <DeleteIcon fontSize="small" sx={{ color: "error.main" }} />
                </IconButton>
              </Tooltip>
              {!isProfile && (
                <Tooltip title="Set as profile">
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: "accent.main",
                      "&:hover": { bgcolor: "accent.dark" },
                    }}
                    onClick={() => onSetProfile(face.id)}
                  >
                    <StarIcon
                      fontSize="small"
                      sx={{ color: "primary.contrastText" }}
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        {!READ_ONLY && (
          <CardContent sx={{ px: 1, py: 1, textAlign: "center" }}>
            {face.person ? (
              <Typography variant="caption" color="primary" display="block">
                Assigned
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} justifyContent="center">
                <Tooltip title="Detach from person">
                  <IconButton size="small" onClick={onDetach}>
                    <LinkOffIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Assign Existing">
                  <IconButton
                    size="small"
                    onClick={() =>
                      setMode((prev) => (prev === "search" ? "none" : "search"))
                    }
                  >
                    <PersonSearchIcon
                      fontSize="small"
                      sx={{
                        color:
                          mode === "search" ? "accent.main" : "text.secondary",
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Create New Person">
                  <IconButton
                    size="small"
                    onClick={() =>
                      setMode((prev) => (prev === "new" ? "none" : "new"))
                    }
                  >
                    <PersonAddIcon
                      fontSize="small"
                      sx={{
                        color:
                          mode === "new" ? "accent.main" : "text.secondary",
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </CardContent>
        )}
      </Card>

      {mode !== "none" &&
        dropdownPosition &&
        ReactDOM.createPortal(renderDropdownContent(), document.body)}
    </>
  );
}
