// src/pages/MapPage.tsx
import React, { useState, useEffect, useRef } from 'react'
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
} from 'react-leaflet'
import { useSearchParams, Link } from 'react-router-dom'
import type { LatLngExpression } from 'leaflet'

interface MediaLocation {
    id: number
    latitude: number
    longitude: number
    thumbnail: string
}

const API = import.meta.env.VITE_API_BASE_URL

function FocusHandler({
    locations,
}: {
    locations: MediaLocation[]
}) {
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
    }, [focusId, locations])

    return null
}

export default function MapPage() {
    const [locations, setLocations] = useState<MediaLocation[]>([])

    useEffect(() => {
        fetch(`${API}/media/locations`)
            .then(r => r.json())
            .then(setLocations)
            .catch(console.error)
    }, [])

    // world center
    const center: LatLngExpression = [20, 0]

    return (
        <div className="h-screen w-full">
            <MapContainer
                center={center}
                zoom={2}
                scrollWheelZoom={true}
                className="h-full"
            >
                <TileLayer
                    attribution="© OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* handle focus after locations load */}
                <FocusHandler locations={locations} />

                {locations.map(loc => (
                    <Marker
                        key={loc.id}
                        position={[loc.latitude, loc.longitude]}
                    >
                        <Popup>
                            <Link to={`/image/${loc.id}`}>
                                <img
                                    src={loc.thumbnail}
                                    alt=""
                                    className="w-24 h-24 object-cover rounded"
                                />
                            </Link>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}
