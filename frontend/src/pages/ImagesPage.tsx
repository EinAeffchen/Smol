import React, { useState, useEffect } from 'react'
import MediaCard from '../components/MediaCard'
import { Media } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function ImagesPage() {
    const [images, setImages] = useState<Media[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/media/images`)
            .then(r => r.json())
            .then(setImages)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-4">Loading images…</div>

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">Images</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {images.map(img => (
                    <MediaCard key={img.id} media={img} />
                ))}
            </div>
        </div>
    )
}
