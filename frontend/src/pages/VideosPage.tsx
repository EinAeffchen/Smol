import React, { useState, useEffect } from 'react'
import MediaCard from '../components/MediaCard'
import { Media } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function VideosPage() {
    const [videos, setVideos] = useState<Media[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/media/videos`)
            .then(r => r.json())
            .then(setVideos)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-4">Loading videos…</div>

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">Videos</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                {videos.map(video => (
                    <MediaCard key={video.id} media={video} />
                ))}
            </div>
        </div>
    )
}
