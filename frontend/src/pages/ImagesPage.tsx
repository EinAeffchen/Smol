import React, { useCallback } from 'react'
import MediaCard from '../components/MediaCard'
import { useInfinite } from '../hooks/useInfinite'
import { Media } from '../types'
import { MediaPreview } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function ImagesPage() {
    const fetchImages = useCallback((skip: number, limit: number) =>
        fetch(`${API}/media/images?skip=${skip}&limit=${limit}`)
            .then(r => r.json() as Promise<MediaPreview[]>), [API])
    const { items: images, hasMore, loaderRef } = useInfinite<MediaPreview>(fetchImages, 20)

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">Images</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {images.map(img => <MediaCard key={img.id} media={img} />)}
            </div>
            {hasMore && (
                <div ref={loaderRef} className="py-8 text-center text-gray-500">
                    Loading more…
                </div>
            )}
        </div>
    )
}
