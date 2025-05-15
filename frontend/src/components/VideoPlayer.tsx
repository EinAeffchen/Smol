// src/components/VideoPlayer.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Box, Paper, CircularProgress, Typography } from '@mui/material'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { Media } from '../types'

export function VideoWithPreview({ media }: { media: Media }) {
    const API = import.meta.env.VITE_API_BASE_URL ?? ''
    const videoRef = useRef<HTMLVideoElement>(null)
    const [loading, setLoading] = useState(true)
    const [useFallback, setUseFallback] = useState(false)
    const mediaUrl = `${API}/originals/${media.path}`

    useEffect(() => {
        if (!videoRef.current) return
        // attempt Plyr initialization
        let player: any
        try {
            // destroy previous instance if any
            const existing = (videoRef.current as any).__plyr__
            if (existing) existing.destroy()

            Plyr.defaults.blankVideo = ''
            player = new Plyr(videoRef.current, {
                controls: ['play', 'progress', 'current-time', 'volume', 'fullscreen'],
            })
            player.on('ready', () => setLoading(false))
            player.on('waiting', () => setLoading(true))
            player.on('playing', () => setLoading(false))
        } catch (err) {
            console.error('Plyr init failed, falling back to native video', err)
            setUseFallback(true)
            setLoading(false)
        }

        return () => {
            if (player) player.destroy()
        }
    }, [mediaUrl])

    // No media
    if (!media.path) {
        return <Typography color="text.secondary">No video available</Typography>
    }

    return (
        <Box display="flex" justifyContent="center" sx={{ width: '100%' }}>
            <Paper
                elevation={4}
                sx={{
                    position: 'relative',
                    borderRadius: 2,
                    overflow: 'hidden',
                    width: '100%',
                    maxWidth: 800,
                    maxHeight: 500,
                    bgcolor: 'background.paper',
                }}
            >
                {loading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.4)',
                            zIndex: 1,
                        }}
                    >
                        <CircularProgress color="secondary" />
                    </Box>
                )}

                {useFallback ? (
                    <video
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                    />
                ) : (
                    <video
                        ref={videoRef}
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        style={{
                            width: '100%',
                            height: '100%',
                            maxHeight: "500px",
                            objectFit: 'contain',
                        }}
                    />
                )}
            </Paper>
        </Box>
    )
}
