import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import { Box } from '@mui/material'
import type { LatLngExpression } from 'leaflet'

interface MediaLocation {
    id: number
    latitude: number
    longitude: number
    thumbnail: string
}

const API = import.meta.env.VITE_API_BASE_URL ?? ''

function FocusHandler({ locations }: { locations: MediaLocation[] }) {
    const map = useMap()
    const [params] = useSearchParams()
    const focusId = params.get('focus')

    useEffect(() => {
        if (!focusId) return
        const id = Number(focusId)
        const loc = locations.find(l => l.id === id)
        if (loc) {
            const center: LatLngExpression = [loc.latitude, loc.longitude]
            map.setView(center, 15, { animate: true })
        }
    }, [focusId, locations, map])

    return null
}

export default function MapPage() {
    const [locations, setLocations] = useState<MediaLocation[]>([])

    useEffect(() => {
        fetch(`${API}/media/locations`)
            .then(res => res.json())
            .then(setLocations)
            .catch(console.error)
    }, [])

    // Default world center
    const center: LatLngExpression = [20, 0]

    return (
        <Box sx={{ height: '100vh', width: '100%' }}>
            <MapContainer
                center={center}
                zoom={2}
                scrollWheelZoom
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution="© OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* handle focus after locations load */}
                <FocusHandler locations={locations} />

                {locations.map(loc => (
                    <Marker key={loc.id} position={[loc.latitude, loc.longitude] as LatLngExpression}>
                        <Popup>
                            <Box
                                component={RouterLink}
                                to={`/media/${loc.id}`}
                                sx={{ display: 'block', width: 96, height: 96, textDecoration: 'none' }}
                            >
                                <Box
                                    component="img"
                                    src={`${API}${loc.thumbnail}`}
                                    alt=""
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                    }}
                                />
                            </Box>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </Box>
    )
}
