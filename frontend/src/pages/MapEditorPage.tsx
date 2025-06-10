import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
    Box,
    Drawer,
    Typography,
    List,
    ListItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    ListItemButton,
    TextField,
    Autocomplete,
    Button,
    CircularProgress,
} from '@mui/material'
import { MediaPreview } from '../types'
import { API } from '../config'

function ClickHandler({ selected, setTempPos }: { selected: MediaPreview | null; setTempPos: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            if (selected) {
                console.log(e);
                const { lat, lng } = e.latlng
                setTempPos([lat, lng])
            }
        }
    })
    return null
}

export default function MapEditorPage() {
    const [orphans, setOrphans] = useState<MediaPreview[]>([])
    const [selected, setSelected] = useState<MediaPreview | null>(null)
    const [tempPos, setTempPos] = useState<[number, number] | null>(null)
    const [saving, setSaving] = useState(false)
    const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)


    const [searchInput, setSearchInput] = useState('')
    const [debouncedInput, setDebouncedInput] = useState<string>('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searchLoading, setSearchLoading] = useState(false)

    useEffect(() => {
        fetch(`${API}/api/media/missing_geo`)
            .then(res => res.json())
            .then(setOrphans)
            .catch(console.error)
    }, [])

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedInput(searchInput), 1000)
        return () => clearTimeout(handler)
    }, [searchInput])

    useEffect(() => {
        if (debouncedInput.length < 1) {
            setSearchResults([])
            return
        }
        setSearchLoading(true)
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}`)
            .then(res => res.json())
            .then(data => { console.log('Got nominatim results', data); setSearchResults(data) })
            .catch(console.error)
            .finally(() => setSearchLoading(false))
    }, [debouncedInput])

    // Fits map bounds to given bounding coordinates
    function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
        const map = useMap()
        useEffect(() => {
            if (bounds) {
                map.flyToBounds(bounds, { animate: true })
            }
        }, [bounds, map])
        return null
    }

    const saveGeo = async () => {
        if (!selected || !tempPos) return
        setSaving(true)
        try {
            const [latitude, longitude] = tempPos
            const res = await fetch(`${API}/api/media/${selected.id}/geolocation`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude }),
            })
            if (!res.ok) throw new Error()
            setOrphans(prev => prev.filter(m => m.id !== selected.id))
            setSelected(null)
            setTempPos(null)
            setConfirmOpen(false)
        } catch (err) {
            console.error('Failed to save location', err)
        } finally {
            setSaving(false)
        }
    }
    const handleMapClick = (pos: [number, number]) => {
        setTempPos(pos)
        setConfirmOpen(true)
    }



    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            <Drawer
                variant="permanent"
                anchor="left"
                open
                sx={{
                    width: 300,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: 300,
                        boxSizing: 'border-box',
                        bgcolor: '#1C1C1E',
                        color: '#FFF',
                        p: 2,
                    },
                }}
            >
                <Typography variant="h6" gutterBottom>
                    Un-located Media
                </Typography>
                <Autocomplete
                    sx={{
                        mb: 2,
                        position: 'sticky',
                        top: 0,
                        bgcolor: 'background.paper',
                        zIndex: 10,
                    }}
                    options={searchResults}
                    getOptionLabel={opt => (opt as any).display_name}
                    inputValue={searchInput}
                    onInputChange={(_, v) => setSearchInput(v)}
                    filterOptions={options => options}
                    noOptionsText={searchLoading ? 'Loading...' : 'No results'}
                    loading={searchLoading}
                    onChange={(_, value) => {
                        if (value) {
                            const lat = parseFloat(value.lat)
                            const lon = parseFloat(value.lon)
                            setTempPos([lat, lon])
                            if (value.boundingbox) {
                                const [south, north, west, east] = (value.boundingbox as string[]).map(parseFloat)
                                setBounds([[south, west], [north, east]])
                            }
                            setSelected(null)
                        }
                    }}
                    renderInput={params => (
                        <TextField
                            {...params}
                            label="Search location"
                            size="small"
                            variant="outlined"
                            slotProps={{
                                input: {
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {searchLoading && <CircularProgress size={16} />}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }
                            }}

                        />
                    )}
                />
                <List>
                    {orphans.map(m => (
                        <ListItem key={m.id} disablePadding>
                            <ListItemButton
                                selected={selected?.id === m.id}
                                onClick={() => {
                                    setSelected(m)
                                    setTempPos(null)
                                }}
                            >
                                <Box
                                    component="img"
                                    src={`${API}/thumbnails/${m.id}.jpg`}
                                    alt=""
                                    sx={{
                                        width: '100%',
                                        maxHeight: "100",
                                        objectFit: 'contain',
                                        borderRadius: 1,
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Drawer>
            <Box sx={{ flex: 1, position: 'relative' }}>
                <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ClickHandler selected={selected} setTempPos={handleMapClick} />
                    <FitBounds bounds={bounds} />
                    {selected && tempPos && (
                        <CircleMarker center={tempPos} radius={8} pathOptions={{ color: 'deepskyblue' }} />
                    )}
                </MapContainer>
                <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                    <DialogTitle>Confirm Marker Placement</DialogTitle>
                    <DialogContent>
                        <Typography>Place marker at latitude {tempPos?.[0].toFixed(4)}, longitude {tempPos?.[1].toFixed(4)}?</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setConfirmOpen(false)}
                            sx={{ color: '#FFF' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={saveGeo}
                            sx={{
                                bgcolor: '#5F4B8B',
                                '&:hover': { bgcolor: '#4A3A6A' },
                                ml: 1
                            }}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    )
}
