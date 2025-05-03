// frontend/src/components/Header.tsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'


const API = import.meta.env.VITE_API_BASE_URL || ''


export function MediaExif({ showExif, id }) {
    const [exif, setExif] = useState<Record<string, any> | null | undefined>(undefined)

    // reset exif for new media
    useEffect(() => {
        setExif(undefined)
    }, [id])

    useEffect(() => {
        if (showExif && exif === undefined) {
            fetch(`${API}/api/media/${id}/processors/exif`)
                .then(r => (r.ok ? r.json() : null))
                .then(body => setExif(body))       // body is object or null
                .catch(() => setExif(null))
        }
    }, [showExif, id])

    return (
        <>
            {/* only render overlay when showExif===true */}
            {showExif && (
                <div className="absolute inset-0 pointer-events-none transition-opacity opacity-100">
                    <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-60 text-white p-4 h-[66%] w--full overflow-auto pointer-events-auto z-10">
                        {
                            // 2.1 still loading?
                            exif === undefined ? (
                                <p>Loading EXIF…</p>
                            ) : (
                                <>
                                    {
                                        // 2.2 we got an object → render fields
                                        exif && typeof exif === 'object' ? (
                                            <>
                                                {exif.make && <p><strong>Camera:</strong> {exif.make} {exif.model}</p>}
                                                {exif.timestamp && <p><strong>Shot:</strong> {new Date(exif.timestamp).toLocaleString()}</p>}
                                                {exif.iso && <p><strong>ISO:</strong> {exif.iso}</p>}
                                                {exif.exposure_time && <p><strong>Shutter:</strong> {exif.exposure_time}s</p>}
                                                {exif.aperture && <p><strong>Aperture:</strong> {exif.aperture}</p>}
                                                {exif.focal_length && <p><strong>Focal:</strong> {exif.focal_length} mm</p>}

                                                {exif.lat != null && exif.lon != null && (
                                                    <Link
                                                        to={`/map?focus=${id}`}
                                                        className="mt-2 inline-block text-blue-300 hover:underline pointer-events-auto"
                                                    >
                                                        View on map 📍
                                                    </Link>
                                                )}
                                            </>
                                        ) : (
                                            // 2.3 exif===null or non-object → no data
                                            <p>No EXIF data available.</p>
                                        )
                                    }
                                </>
                            )
                        }
                    </div>
                </div>
            )}
        </>
    )
}
