import React, { useState } from 'react';
import { NavLink as RouterNavLink, useNavigate, Link } from 'react-router-dom';
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
  styled
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskManager from '../components/TasksPanel';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { API, READ_ONLY, ENABLE_PEOPLE } from '../config';

const StyledNavLink = styled(RouterNavLink)(({ theme }) => ({
  color: theme.palette.text.primary,
  textDecoration: 'none',
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  transition: 'color 0.2s ease-in-out, background-color 0.2s ease-in-out',

  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.active': {
    color: theme.palette.accent.main,
  },
}));

function MobileDrawer({ open, onClose, navItems }: { open: boolean; onClose: () => void; navItems: [string, string][] }) {
  // Removed theme context logic as it's no longer needed here
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { backgroundColor: 'background.default', color: 'text.primary', width: 280 } }
      }}
    >
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center' }}>
        <Link to="/" onClick={onClose}>
          <Box component="img" src={`${API}/static/logo.png`} alt="SMOL logo" sx={{ height: 40 }} />
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
        {/* The theme toggle has been removed from the drawer */}
      </List>

      {!READ_ONLY && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
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
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'media' | 'person' | 'tag'>('media');
  const navigate = useNavigate();

  const allNavItems: [string, string][] = [
    ['Images', '/images'],
    ['Videos', '/videos'],
    ['Tags', '/tags'],
    ['People', '/people'],
    ['Faces', '/orphanfaces'],
    ['Map', '/map'],
    ['Geotagger', '/maptagger'],
  ];

  const pathsToExcludeInReadOnly: string[] = ['/orphanfaces', '/maptagger'];
  const pathsToExcludeInPeopleDisabled: string[] = ["/people"];
  let visibleNavItems = allNavItems.filter(
    ([, path]) => !(READ_ONLY && pathsToExcludeInReadOnly.includes(path)) && !(!ENABLE_PEOPLE && pathsToExcludeInPeopleDisabled.includes(path))
  );

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/searchresults?` + new URLSearchParams({ category, query: trimmed }).toString());
    setIsSearchVisible(false);
    setQ('');
  }

  const renderDefaultHeader = () => (
    <>
      <Link to="/">
        <Box component="img" src={`${API}/static/logo.png`} alt="SMOL logo" sx={{ height: 48, display: { xs: 'none', sm: 'block' }, mr: 2 }} />
        <Box component="img" src={`${API}/static/logo.png`} alt="SMOL logo" sx={{ height: 40, display: { xs: 'block', sm: 'none' } }} />
      </Link>

      <Box component="form" onSubmit={onSearchSubmit} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', flexGrow: 1, maxWidth: 600 }}>
        <Select variant="outlined" size="small" value={category} onChange={(e) => setCategory(e.target.value as any)} >
          <MenuItem value="media">Media</MenuItem>
          <MenuItem value="person">People</MenuItem>
          <MenuItem value="tag">Tags</MenuItem>
        </Select>
        <TextField variant="outlined" size="small" fullWidth value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
        <button type="submit" style={{ display: 'none' }} />
      </Box>

      {/* This Box pushes everything after it to the right */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Desktop Navigation & Actions */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
        {visibleNavItems.map(([label, to]) => (
          <StyledNavLink key={to} to={to}>
            {label}
          </StyledNavLink>
        ))}
        <ThemeToggleButton />
        {!READ_ONLY && (
          <IconButton onClick={() => setIsControlPanelOpen(true)} color="primary" title="Open Control Panel">
            <SettingsIcon />
          </IconButton>
        )}
      </Box>

      {/* Mobile Actions */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
        <IconButton color="primary" onClick={() => setIsSearchVisible(true)}>
          <SearchIcon />
        </IconButton>
        {/* Theme toggle is now here on mobile */}
        <ThemeToggleButton />
        <IconButton color="primary" onClick={() => setIsDrawerOpen(true)}>
          <MenuIcon />
        </IconButton>
      </Box>
    </>
  );

  const renderSearchHeader = () => (
    <>
      <IconButton color="primary" onClick={() => setIsSearchVisible(false)}>
        <ArrowBackIcon />
      </IconButton>
      <Box component="form" onSubmit={onSearchSubmit} sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
        <Select variant="outlined" size="small" value={category} onChange={(e) => setCategory(e.target.value as any)} >
          <MenuItem value="media">Media</MenuItem>
          <MenuItem value="person">People</MenuItem>
          <MenuItem value="tag">Tags</MenuItem>
        </Select>
        <TextField variant="outlined" size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" autoFocus fullWidth />
        <button type="submit" style={{ display: 'none' }} />
      </Box>
    </>
  );

  return (
    <>
      <AppBar position="sticky" sx={{ backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
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
          paper: { sx: { backgroundColor: 'background.default', color: 'text.primary', width: 280 } }
        }}
      >
        {!READ_ONLY && (
          <Box sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Control Panel
            </Typography>
            <TaskManager />
          </Box>
        )}
      </Drawer>
    </>
  );
}