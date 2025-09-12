import React, { useEffect, useState } from "react";
import { NavLink as RouterNavLink, useNavigate, Link } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Typography,
  styled,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SettingsIcon from "@mui/icons-material/Settings";
import TaskManager from "../components/TasksPanel";
import ThemeToggleButton from "../components/ThemeToggleButton";
import { searchByImage } from "../services/searchActions";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import config from "../config";
import { API } from "../config";

const logoUrl = `${API}/static/logo.png`;

const StyledNavLink = styled(RouterNavLink)(({ theme }) => ({
  color: theme.palette.text.primary,
  textDecoration: "none",
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  transition: "color 0.2s ease-in-out, background-color 0.2s ease-in-out",

  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&.active": {
    color: theme.palette.accent.main,
  },
}));

function MobileDrawer({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: [string, string][];
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "background.default",
            color: "text.primary",
            width: 280,
          },
        },
      }}
    >
      <Box sx={{ p: 1, display: "flex", alignItems: "center" }}>
        <Link to="/" onClick={onClose}>
          <Box
            component="img"
            src={logoUrl}
            alt="SMOL logo"
            sx={{ height: 40 }}
          />
        </Link>
      </Box>
      <Divider />

      <List>
        {navItems.map(([label, to]) => (
          <ListItem key={to} disablePadding>
            <ListItemButton component={RouterNavLink} to={to} onClick={onClose}>
              <ListItemText primary={label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {!config.READ_ONLY && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              Control Panel
            </Typography>
            <TaskManager />
          </Box>
        </>
      )}
    </Drawer>
  );
}

export function Header() {
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"media" | "person" | "tag">("media");
  // Force a re-render when runtime config updates (e.g., read-only flag changes)
  const [configTick, setConfigTick] = useState(0);
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null); // Ref for the hidden file input

  useEffect(() => {
    const handler = () => setConfigTick((v) => v + 1);
    window.addEventListener("runtime-config-updated", handler as EventListener);
    return () =>
      window.removeEventListener(
        "runtime-config-updated",
        handler as EventListener
      );
  }, []);

  const allNavItems: [string, string][] = [
    ["Images", "/images"],
    ["Videos", "/videos"],
    ["Tags", "/tags"],
    ["People", "/people"],
    ["Faces", "/orphanfaces"],
    ["Map", "/map"],
    ["Geotagger", "/maptagger"],
    ["Duplicates", "/duplicates"],
    ["Configuration", "/configuration"],
  ];

  const pathsToExcludeInReadOnly: string[] = [
    "/orphanfaces",
    "/maptagger",
    "/duplicates",
  ];
  const pathsToExcludeInPeopleDisabled: string[] = ["/people"];
  const visibleNavItems = allNavItems.filter(
    ([, path]) =>
      !(config.READ_ONLY && pathsToExcludeInReadOnly.includes(path)) &&
      !(!config.ENABLE_PEOPLE && pathsToExcludeInPeopleDisabled.includes(path))
  );

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(
      `/searchresults?` +
        new URLSearchParams({ category, query: trimmed }).toString(),
      { replace: true, state: { timestamp: Date.now() } }
    );
    setIsSearchVisible(false);
  }

  const renderDefaultHeader = () => (
    <>
      <Link to="/">
        <Box
          component="img"
          src={logoUrl}
          alt="SMOL logo"
          sx={{ height: 48, display: { xs: "none", sm: "block" }, mr: 2 }}
        />
        <Box
          component="img"
          src={logoUrl}
          alt="SMOL logo"
          sx={{ height: 40, display: { xs: "block", sm: "none" } }}
        />
      </Link>

      <Box sx={{ display: { xs: "none", lg: "flex" } /* ... */ }}>
        {renderSearchInputs()}
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          alignItems: "center",
          gap: 0.5,
        }}
      >
        {visibleNavItems.map(([label, to]) => (
          <StyledNavLink key={to} to={to} state={{}} replace>
            {label}
          </StyledNavLink>
        ))}
        <ThemeToggleButton />
        {!config.READ_ONLY && (
          <IconButton
            onClick={() => setIsControlPanelOpen(true)}
            color="primary"
            title="Open Control Panel"
          >
            <SettingsIcon />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: { xs: "flex", lg: "none" }, alignItems: "center" }}>
        <IconButton color="primary" onClick={() => setIsSearchVisible(true)}>
          <SearchIcon />
        </IconButton>
        <ThemeToggleButton />
        <IconButton color="primary" onClick={() => setIsDrawerOpen(true)}>
          <MenuIcon />
        </IconButton>
      </Box>
    </>
  );

  const renderSearchInputs = () => (
    <Box
      component="form"
      onSubmit={onSearchSubmit}
      sx={{ display: "flex", flexGrow: 1, alignItems: "center" }}
    >
      <Select
        variant="outlined"
        size="small"
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as "media" | "person" | "tag")
        }
        sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      >
        <MenuItem value="media">Media</MenuItem>
        <MenuItem value="person">People</MenuItem>
        <MenuItem value="tag">Tags</MenuItem>
      </Select>
      <TextField
        variant="outlined"
        size="small"
        fullWidth
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by text..."
        sx={{
          "& .MuiOutlinedInput-root": {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
        }}
      />
      <IconButton
        color="primary"
        title="Search by image"
        onClick={() => fileInputRef.current?.click()} // Trigger the hidden input
        sx={{ ml: 1 }}
      >
        <PhotoCameraIcon />
      </IconButton>
      <button type="submit" style={{ display: "none" }} />
    </Box>
  );

  const renderSearchHeader = () => (
    <>
      <IconButton color="primary" onClick={() => setIsSearchVisible(false)}>
        <ArrowBackIcon />
      </IconButton>
      {renderSearchInputs()}
    </>
  );

  const handleImageSearch = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const results = await searchByImage(file);
      navigate("/searchresults?category=media&query=Image Search", {
        state: {
          items: results,
          searchType: "image",
        },
      });
    } catch (error) {
      console.error("Image search failed:", error);
    }

    if (event.target) event.target.value = "";
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSearch}
        accept="image/*"
        style={{ display: "none" }}
      />
      <AppBar
        position="sticky"
        sx={{
          backgroundColor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {isSearchVisible ? renderSearchHeader() : renderDefaultHeader()}
        </Toolbar>
      </AppBar>

      <MobileDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navItems={visibleNavItems}
      />

      <Drawer
        anchor="right"
        open={isControlPanelOpen}
        onClose={() => setIsControlPanelOpen(false)}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "background.default",
              color: "text.primary",
              width: 280,
            },
          },
        }}
      >
        {!config.READ_ONLY && (
          <Box sx={{ p: 2 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              Control Panel
            </Typography>
            <TaskManager />
          </Box>
        )}
      </Drawer>
    </>
  );
}
