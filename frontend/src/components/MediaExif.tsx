import React, { useState, useEffect } from 'react'
import { Box, Typography, Link as RouterLink, CircularProgress } from '@mui/material'
import { Link } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE_URL ?? ''
const BG_OVERLAY = 'rgba(0, 0, 0, 0.6)'
const TEXT = '#FFF'
const ACCENT = '#FF2E88'

interface MediaExifProps {
    show: boolean
    mediaId: number
}

export function MediaExif({ show, mediaId }: MediaExifProps) {
    const [exif, setExif] = useState<Record<string, any> | null | undefined>(undefined)

    // Reset on mediaId change
    useEffect(() => {
        setExif(undefined)
    }, [mediaId])

    // Fetch EXIF when shown
    useEffect(() => {
        if (show && exif === undefined) {
            fetch(`${API}/api/media/${mediaId}/processors/exif`)
                .then(res => (res.ok ? res.json() : null))
                .then(body => setExif(body))
                .catch(() => setExif(null))
        }
    }, [show, mediaId])

    if (!show) return null

    // Determine if we have any EXIF properties
    const hasData =
        exif &&
        typeof exif === 'object' &&
        (
            exif.timestamp != null ||
            Object.keys(exif).some(
                key => ['make', 'model', 'iso', 'exposure_time', 'aperture', 'focal_length', 'lat', 'lon'].includes(key) && exif[key] != null
            )
        )


    return (
        <Box
            sx={{
                position: 'relative', inset: 0,
                bgcolor: BG_OVERLAY,
                color: TEXT,
                p: 2,
                overflowY: 'auto',
                zIndex: 10,
            }}
        >
            {exif === undefined ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress color="secondary" />
                </Box>
            ) : hasData ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {exif.make && (
                        <Typography><strong>Camera:</strong> {exif.make} {exif.model}</Typography>
                    )}
                    {exif.timestamp && (
                        <Typography><strong>Shot:</strong> {new Date(exif.timestamp).toLocaleString()}</Typography>
                    )}
                    {exif.iso && <Typography><strong>ISO:</strong> {exif.iso}</Typography>}
                    {exif.exposure_time && <Typography><strong>Shutter:</strong> {exif.exposure_time}s</Typography>}
                    {exif.aperture && <Typography><strong>Aperture:</strong> {exif.aperture}</Typography>}
                    {exif.focal_length && <Typography><strong>Focal:</strong> {exif.focal_length} mm</Typography>}

                    {exif.lat != null && exif.lon != null && (
                        <RouterLink
                            component={Link}
                            to={`/map?focus=${mediaId}`}
                            sx={{ mt: 2, color: ACCENT, '&:hover': { textDecoration: 'underline' } }}
                        >
                            View on map 📍
                        </RouterLink>
                    )}
                </Box>
            ) : (
                <Typography>No EXIF data available.</Typography>
            )}
        </Box>
    )
}
