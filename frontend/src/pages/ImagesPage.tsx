import React, { useCallback } from 'react'
import MediaCard from '../components/MediaCard'
import { useInfinite } from '../hooks/useInfinite'
import { MediaPreview } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function ImagesPage() {
    const fetchImages = useCallback((skip: number, limit: number) =>
        fetch(`${API}/media/images?skip=${skip}&limit=${limit}`)
            .then(r => r.json() as Promise<MediaPreview[]>), [API])
    const { items: images, hasMore, loading, loaderRef } = useInfinite<MediaPreview>(fetchImages, 20)

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">Images</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {images.map(img => <MediaCard key={img.id} media={img} />)}
            </div>
            {loading && (
                <div className="py-4 text-center text-gray-500">
                    Loading…
                </div>
            )}
            {!loading && hasMore && (
                <div
                    ref={loaderRef}
                    className="py-4 text-center text-gray-500"
                >
                    Scroll to load more…
                </div>
            )}
        </div>
    )
}
