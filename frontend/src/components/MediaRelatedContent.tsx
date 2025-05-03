// frontend/src/components/Header.tsx
import React, { useState, useEffect } from 'react'
import { MediaPreview, Media } from '../types'
import MediaCard from '../components/MediaCard'

const API = import.meta.env.VITE_API_BASE_URL || ''


export function SimilarContent({ media }: { media: Media }) {
    const [similar, setSimilar] = useState<MediaPreview[]>([])

    useEffect(() => {
        if (!media?.id) return
        fetch(`${API}/media/${media.id}/get_similar`)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load similar media")
                return r.json()
            })
            .then(setSimilar)
            .catch(console.error)
    }, [media?.id])

    return (
        <>
            {/* Related (stub; implement via your /media?person_id=… or /media?tags=…) */}
            {similar.length > 0 && (
                <section className="mt-8">
                    <h3 className="text-xl font-semibold mb-4">Similar Content</h3>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                        {similar.map(m => (
                            <MediaCard key={m.id} media={m} />
                        ))}
                    </div>
                </section>
            )}
        </>
    )
}
