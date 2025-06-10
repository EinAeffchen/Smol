import React, { useCallback } from 'react'
import MediaCard from '../components/MediaCard'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import { MediaPreview } from '../types'
import { API } from '../config'


export default function ImagesPage() {
    const pageSize = 20;
    const fetchImages = useCallback(
        (cursor: string | null, limit: number) =>
            fetch(
                `${API}/api/media/images${cursor ? `?cursor=${cursor}&` : "?"
                }limit=${limit}`
            ).then((r) =>
                r.json() as Promise<CursorResponse<MediaPreview>>
            ),
        [API]
    )
    const { items: images, setItems: setImages, hasMore, loading, loaderRef } =
        useInfinite<MediaPreview>(fetchImages, pageSize, [])

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
