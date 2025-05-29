import React, { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
  Drawer,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SettingsIcon from '@mui/icons-material/Settings'
import ControlPanelModal from './ControlPanelModal'

const API = import.meta.env.VITE_API_BASE_URL ?? ""


export function Header() {
  const [openPanel, setOpenPanel] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<'media' | 'person' | 'tag'>('media')
  const navigate = useNavigate()

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    navigate(`/searchresults?` + new URLSearchParams({ category, query: trimmed }).toString())
  }

  return (
    <>
      <AppBar
        position="sticky"
        sx={{
          backgroundColor: '#1C1C1E',
          borderBottom: '1px solid #333',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {/* Logo */}
          <Link to="/">
            <Box component="img" src={`${API}/static/logo.png`} alt="SMOL logo" sx={{ height: 48 }} />
          </Link>

          {/* Search bar */}
          <Box component="form" onSubmit={onSearchSubmit} sx={{ display: 'flex', flexGrow: 1 }}>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              sx={{
                backgroundColor: '#2C2C2E',
                color: '#FFFFFF',
                borderTopLeftRadius: 20,
                borderBottomLeftRadius: 20,
                '& .MuiSelect-icon': { color: '#FF2E88' },
              }}
            >
              <MenuItem value="media">Media</MenuItem>
              <MenuItem value="person">People</MenuItem>
              <MenuItem value="tag">Tags</MenuItem>
            </Select>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              variant="outlined"
              fullWidth
              sx={{ minWidth: 200 }}
              slotProps={{
                root: {
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      borderTopRightRadius: 20,
                      borderBottomRightRadius: 20,
                      backgroundColor: '#2C2C2E',
                      color: '#FFF',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#444',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FF2E88',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#FF2E88',
                    },
                  },
                },
              }}
            />
            <button type="submit" style={{ display: 'none' }} />
          </Box>

          {/* Desktop nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2 }}>
            {[
              ['Images', '/images'],
              ['Videos', '/videos'],
              ['Tags', '/tags'],
              ['People', '/people'],
              ['Unassigned Faces', '/orphanfaces'],
              ['Map', '/map'],
              ['Geotagger', '/maptagger'],
            ].map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  color: isActive ? '#FF2E88' : '#BFA2DB',
                  textDecoration: 'none',
                  fontWeight: 500,
                })}
              >
                {label}
              </NavLink>
            ))}
          </Box>

          <IconButton
            onClick={() => setOpenPanel(true)}
            sx={{
              ml: 2,
              color: '#BFA2DB',
              display: { xs: 'none', md: 'inline-flex' }, // visible only on desktop/tablet
            }}
            title="Open Control Panel"
          >
            <SettingsIcon />
          </IconButton>
          {/* Mobile Menu Button */}
          <IconButton
            sx={{ color: '#BFA2DB', display: { xs: 'flex', md: 'none' } }}
            onClick={() => setOpenPanel(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={openPanel}
        onClose={() => setOpenPanel(false)}
        PaperProps={{ sx: { backgroundColor: '#1C1C1E', color: '#FFF', width: 280 } }}
      >
        <ControlPanelModal onClose={() => setOpenPanel(false)} />
      </Drawer>
    </>
  )
}
