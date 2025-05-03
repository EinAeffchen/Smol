// src/pages/MapEditorPage.tsx
import React, { useState, useEffect } from 'react'
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    CircleMarker,
    useMapEvents
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MediaPreview } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function MapEditorPage() {
    const [orphans, setOrphans] = useState<MediaPreview[]>([])
    const [selected, setSelected] = useState<MediaPreview | null>(null)
    const [tempPos, setTempPos] = useState<[number, number] | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch(`${API}/media/missing_geo`)
            .then(r => r.json())
            .then(setOrphans)
            .catch(console.error)
    }, [])

    // 2) map click / marker drag
    function ClickHandler() {
        useMapEvents({
            click(e) {
                if (!selected) return
                setTempPos([e.latlng.lat, e.latlng.lng])
                saveGeo()
            }
        })
        return null
    }

    async function saveGeo() {
        if (!selected || !tempPos) return
        setSaving(true)
        const [latitude, longitude] = tempPos
        const res = await fetch(
            `${API}/media/${selected.id}/geolocation`, // or your exif-plugin endpoint
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude }),
            }
        )
        if (res.ok) {
            // drop that media out of the orphan list
            setOrphans(o => o.filter(m => m.id !== selected.id))
            setSelected(null)
            setTempPos(null)
        } else {
            alert('Failed to save location')
        }
        setSaving(false)
    }

    return (
        <div className="flex h-screen">
            {/* ————————————————— Sidebar ————————————————— */}
            <aside className="w-80 bg-gray-800 text-white p-4 overflow-y-auto">
                <h2 className="text-lg mb-2">Un-located Media</h2>
                {orphans.map(m => (
                    <div
                        key={m.id}
                        onClick={() => { setSelected(m); setTempPos(null) }}
                        className={`cursor-pointer mb-3 p-2 rounded 
                  ${selected?.id === m.id
                                ? 'bg-gray-600'
                                : 'hover:bg-gray-700'}`}
                    >
                        <img
                            src={`/thumbnails/${m.id}.jpg`}
                            alt={m.filename}
                            className="w-full mb-1 rounded"
                        />
                        <div className="truncate text-sm">{m.filename}</div>
                    </div>
                ))}
            </aside>

            {/* ————————————————— Map ————————————————— */}
            <div className="relative flex-1">
                <MapContainer
                    center={[0, 0]}
                    zoom={2}
                    className="w-full h-full"
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ClickHandler />

                    {/* all already-located from EXIF */}
                    {/** you could also fetch + render the already-located here **/}

                    {/* the “ghost” pin for your current selection */}
                    {selected && tempPos && (
                        <CircleMarker
                            center={tempPos}
                            radius={8}
                            pathOptions={{ color: 'deepskyblue' }}
                            eventHandlers={{
                                dragend(e) {
                                    const { lat, lng } = (e.target as any).getLatLng()
                                    setTempPos([lat, lng])
                                }
                            }}
                            draggable
                        />
                    )}
                </MapContainer>

                {/* — Save button always visible in bottom-right — */}
                {selected && (
                    <button
                        onClick={saveGeo}
                        disabled={saving || !tempPos}
                        className={`
                  absolute bottom-6 right-6 px-4 py-2 rounded shadow-lg
                  ${saving || !tempPos
                                ? 'bg-gray-500 cursor-not-allowed'
                                : 'bg-accent hover:bg-accent2 text-white'}
                `}
                    >
                        {saving ? 'Saving…' : 'Save Location'}
                    </button>
                )}
            </div>
        </div>
    )
}
