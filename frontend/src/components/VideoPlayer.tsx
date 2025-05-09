import React, { useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { Media } from '../types'

export function VideoWithPreview({
    media,
}: Readonly<{
    media: Media
}>) {
    const API = import.meta.env.VITE_API_BASE_URL;
    const ref = useRef<HTMLVideoElement>(null)
    const vttUrl = `${API}/media/${media.id}/scenes.vtt`

    const mediaUrl = `${API}/originals/${media.path}`
    useEffect(() => {
        if (!ref.current) return

        const old = (ref.current as any).__plyr__
        if (old) old.destroy()

        // Remove blank fallback
        Plyr.defaults.blankVideo = ''

        // tell Plyr where to fetch your WebVTT sprite map
        const player = new Plyr(ref.current, {
            previewThumbnails: { enabled: true, src: vttUrl },
            controls: ['play', 'progress', 'current-time', 'volume', 'fullscreen'],
        })

        return () => { player.destroy() }
    }, [vttUrl])

    return (
        <video
            ref={ref}
            src={mediaUrl}
            controls
            preload="metadata"
            className="w-full rounded-lg shadow"
        />
    )
}
