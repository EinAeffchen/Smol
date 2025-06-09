import React, { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import 'plyr/dist/plyr.css'
import Plyr from 'plyr'
import { Media } from '../types'

// .plyr--fullscreen-active video { max-height: 100vh !important; }

export function VideoWithPreview({ media }: { media: Media }) {
    const API = import.meta.env.VITE_API_BASE_URL ?? ''
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const plyrInstanceRef = useRef<Plyr | null>(null);

    const [loading, setLoading] = useState(true)
    const mediaUrl = `/originals/${media.path}`

    useEffect(() => {
        if (!playerContainerRef.current || !media.path) {
            if (!media.path) setLoading(false); // No media to load
            return;
        }

        setLoading(true);
        // Clear previous Plyr instance and its video element if any
        if (plyrInstanceRef.current) {
            try {
                plyrInstanceRef.current.destroy();
            } catch (e) {
                console.warn('Error destroying previous Plyr instance:', e);
            }
            plyrInstanceRef.current = null;
        }
        if (playerContainerRef.current) { // Defensive check
            playerContainerRef.current.innerHTML = ''; // Clear any leftover video tags
        }

        // wipe previous children completely (in case React reused container)
        playerContainerRef.current.innerHTML = ''

        // Create video element manually
        const video = document.createElement('video')
        video.src = mediaUrl
        video.setAttribute('controls', 'true')
        video.setAttribute('preload', 'metadata')

        video.style.display = 'block'
        video.style.width = '100%'

        video.style.maxHeight = '500px'
        video.style.objectFit = 'contain'

        playerContainerRef.current.appendChild(video)

        const player = new Plyr(video, {
            controls: ['play', 'progress', 'current-time', 'volume', 'fullscreen'],
            previewThumbnails: {
                enabled: true,
                src: `${API}/media/${media.id}/scenes.vtt`
            },
            fullscreen: {
                enabled: true,
                fallback: true,
                iosNative: false
            }
        });

        plyrInstanceRef.current = player;

        player.on('ready', () => setLoading(false));
        player.on('waiting', () => setLoading(true));
        player.on('playing', () => setLoading(false));
        player.on('error', (event) => {
            console.error('Plyr error:', event);
            setLoading(false);
            // Consider setUseFallback(true) here if the error is critical
        });

        player.on('enterfullscreen', () => {
            console.log('Plyr event: enterfullscreen triggered.');
            if (player && player.elements && player.elements.container) {
                // Log immediately
                console.log('IMMEDIATE Player container classes:', player.elements.container.className);

                // Log after a micro-task delay
                setTimeout(() => {
                    if (plyrInstanceRef.current && plyrInstanceRef.current.elements && plyrInstanceRef.current.elements.container) { // Re-check instance
                        console.log('DELAYED Player container classes:', plyrInstanceRef.current.elements.container.className);
                    }
                }, 0);
            }
            // Your manual class addition (keep this as it's a reliable workaround)
            playerContainerRef.current?.classList.add('custom-fullscreen-active');
        });

        player.on('exitfullscreen', () => {
            console.log('Plyr event: exitfullscreen triggered.');
            // Your manual class removal
            playerContainerRef.current?.classList.remove('custom-fullscreen-active');
            // You can add a delayed log here too if you want to check Plyr's class removal
            setTimeout(() => {
                if (plyrInstanceRef.current && plyrInstanceRef.current.elements && plyrInstanceRef.current.elements.container) {
                    console.log('DELAYED Player container classes on exit:', plyrInstanceRef.current.elements.container.className);
                }
            }, 0);
        });

        return () => {
            if (plyrInstanceRef.current) {
                try {
                    plyrInstanceRef.current.destroy();
                } catch (e) {
                    console.warn('Error destroying Plyr instance on cleanup:', e);
                }
                plyrInstanceRef.current = null;
            }
            // Ensure custom class is removed on component unmount/media change
            if (playerContainerRef.current) {
                playerContainerRef.current.classList.remove('custom-fullscreen-active');
            }
        };
    }, [mediaUrl, API, media.id]);

    // No media
    if (!media.path) {
        return <Typography color="text.secondary">No video available</Typography>
    }

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%', // This Box should fill the ParentPaper from MediaDetailPage
                position: 'relative', // For the loading indicator
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
                        borderRadius: 'inherit', // Match parent's rounding
                    }}
                >
                    <CircularProgress color="secondary" />
                </Box>
            )}

            <div ref={playerContainerRef} style={{ width: '100%', height: '100%' }} />
        </Box >
    )
}
