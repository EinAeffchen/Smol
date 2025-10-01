import React, { useEffect, useState } from "react";
import {
  NavLink as RouterNavLink,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  Button,
  TextField,
  Select,
  Menu,
  MenuItem,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
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
import { useTheme } from "@mui/material/styles";

type NavItem = { label: string; to: string };
type NavSection = { label: string; items: NavItem[] };

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
  navSections,
}: {
  open: boolean;
  onClose: () => void;
  navSections: NavSection[];
}) {
  const theme = useTheme();
  const base = import.meta.env.BASE_URL || "/";
  const wordmarkSrc = `${base}brand/omoide_header_${theme.palette.mode}.png`;
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
            src={wordmarkSrc}
            alt="omoide"
            sx={{ width: 160, height: "auto" }}
          />
        </Link>
      </Box>
      <Divider />

      <List>
        {navSections.map((section) => (
          <React.Fragment key={section.label}>
            <ListSubheader
              disableSticky
              sx={{
                backgroundColor: "background.default",
                color: "text.secondary",
                fontWeight: 600,
              }}
            >
              {section.label}
            </ListSubheader>
            {section.items.map(({ label, to }) => (
              <ListItem key={to} disablePadding>
                <ListItemButton
                  component={RouterNavLink}
                  to={to}
                  onClick={onClose}
                >
                  <ListItemText primary={label} />
                </ListItemButton>
              </ListItem>
            ))}
          </React.Fragment>
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
            <TaskManager isActive={open} />
          </Box>
        </>
      )}
    </Drawer>
  );
}

export function Header() {
  const theme = useTheme();
  const base = import.meta.env.BASE_URL || "/";
  const wordmarkSrc = `${base}brand/omoide_header_${theme.palette.mode}.png`;
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [q, setQ] = useState("");
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [openSectionLabel, setOpenSectionLabel] = useState<string | null>(null);
  const [category, setCategory] = useState<
    "media" | "person" | "tag" | "scene"
  >("media");
  // Force a re-render when runtime config updates (e.g., read-only flag changes)
  const [configTick, setConfigTick] = useState(0);
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null); // Ref for the hidden file input
  const location = useLocation();

  useEffect(() => {
    const handler = () => setConfigTick((v) => v + 1);
    window.addEventListener("runtime-config-updated", handler as EventListener);
    return () =>
      window.removeEventListener(
        "runtime-config-updated",
        handler as EventListener
      );
  }, []);

  const RAW_SECTIONS: NavSection[] = [
    {
      label: "Library",
      items: [
        { label: "Images", to: "/images" },
        { label: "Videos", to: "/videos" },
        { label: "Tags", to: "/tags" },
      ],
    },
    {
      label: "People",
      items: [
        { label: "People", to: "/people" },
        { label: "Faces", to: "/orphanfaces" },
      ],
    },
    {
      label: "Map",
      items: [
        { label: "Map", to: "/map" },
        { label: "Geotagger", to: "/maptagger" },
      ],
    },
    {
      label: "Maintenance",
      items: [
        { label: "Duplicates", to: "/duplicates" },
        { label: "Review Missing", to: "/missing" },
      ],
    },
    {
      label: "Configuration",
      items: [{ label: "Configuration", to: "/configuration" }],
    },
  ];

  const pathsToExcludeInReadOnly: string[] = [
    "/orphanfaces",
    "/maptagger",
    "/duplicates",
  ];
  const pathsToExcludeInPeopleDisabled: string[] = ["/people"];
  const shouldHidePath = (path: string) =>
    (config.READ_ONLY && pathsToExcludeInReadOnly.includes(path)) ||
    (!config.ENABLE_PEOPLE && pathsToExcludeInPeopleDisabled.includes(path));

  const navSections: NavSection[] = RAW_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((it) => !shouldHidePath(it.to)),
  })).filter((section) => section.items.length > 0);

  const flatVisibleNavItems: NavItem[] = navSections.flatMap((s) => s.items);

  const openSection = (label: string) => (e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(e.currentTarget);
    setOpenSectionLabel(label);
  };

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setOpenSectionLabel(null);
  };

  const isSectionOpen = (label: string) => openSectionLabel === label;

  const isSectionActive = (section: NavSection) =>
    section.items.some((it) => location.pathname.startsWith(it.to));

  const sectionMenuId = (label: string) =>
    `section-menu-${label.toLowerCase().replace(/\s+/g, "-")}`;

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
          src={wordmarkSrc}
          alt="omoide logo"
          sx={{
            width: 180,
            height: "auto",
            display: { xs: "none", sm: "block" },
            mr: 2,
          }}
        />
        <Box
          component="img"
          src={wordmarkSrc}
          alt="omoide logo"
          sx={{
            width: 150,
            height: "auto",
            display: { xs: "block", sm: "none" },
          }}
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
        {navSections.map((section) => {
          const active = isSectionActive(section);
          const menuId = sectionMenuId(section.label);
          if (section.items.length === 1) {
            const [item] = section.items;
            return (
              <Button
                key={section.label}
                component={RouterNavLink}
                to={item.to}
                replace
                state={{}}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 1,
                  "&:hover": { backgroundColor: "action.hover" },
                  color: active ? "accent.main" : "text.primary",
                }}
              >
                {item.label}
              </Button>
            );
          }
          return (
            <React.Fragment key={section.label}>
              <Button
                onClick={openSection(section.label)}
                aria-controls={
                  isSectionOpen(section.label) ? menuId : undefined
                }
                aria-haspopup="true"
                aria-expanded={
                  isSectionOpen(section.label) ? "true" : undefined
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 1,
                  "&:hover": { backgroundColor: "action.hover" },
                  color: active ? "accent.main" : "text.primary",
                }}
              >
                {section.label}
              </Button>

              <Menu
                id={menuId}
                anchorEl={menuAnchorEl}
                open={isSectionOpen(section.label)}
                onClose={closeMenu}
                keepMounted
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                MenuListProps={{ "aria-labelledby": menuId }}
              >
                {section.items.map((item) => (
                  <MenuItem
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    // keep your navigation behavior consistent
                    replace
                    state={{}}
                    onClick={closeMenu}
                    sx={{ minWidth: 200 }}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </React.Fragment>
          );
        })}

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
          setCategory(e.target.value as "media" | "person" | "tag" | "scene")
        }
        sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      >
        <MenuItem value="media">Media</MenuItem>
        <MenuItem value="person">People</MenuItem>
        <MenuItem value="tag">Tags</MenuItem>
        <MenuItem value="scene">Scenes</MenuItem>
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
        navSections={navSections}
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
            <TaskManager isActive={isControlPanelOpen} />
          </Box>
        )}
      </Drawer>
    </>
  );
}
