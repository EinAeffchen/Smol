import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Face, Tag, Person } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function ImageDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [media, setMedia] = useState<Media | null>(null)

    useEffect(() => {
        if (!id) return
        fetch(`${API}/media/${id}`)
            .then(res => res.json())
            .then((m: Media) => setMedia(m))
            .catch(console.error)
    }, [id])

    if (!media) return <div className="p-4">Loading…</div>

    return (
        <div className="bg-background text-text min-h-screen">
            <header className="flex items-center p-4 space-x-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">{media.filename}</h1>
            </header>

            <main className="p-4 space-y-8">
                {/* Photo Display */}
                <figure className="mx-auto max-w-xl">
                    <img
                        src={`/originals/${media.path}`}
                        alt={media.filename}
                        className="w-full rounded-lg shadow-lg"
                    />
                </figure>

                {/* Detected Persons */}
                <section>
                    <h2>Detected Persons</h2>
                    <div className="flex gap-4">
                        {persons.map(p => (
                            <PersonCard person={p} />
                        ))}
                    </div>
                </section>

                {/* Tags */}
                <section>
                    <h2 className="text-xl font-semibold mb-2">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {(media.tags ?? []).map((tag: Tag) => (
                            <span
                                key={tag.id}
                                className="px-3 py-1 rounded-full bg-accent2 text-background text-sm"
                            >
                                {tag.name}
                            </span>
                        ))}
                    </div>
                </section>

                {/* Related */}
                <section>
                    <h2 className="text-xl font-semibold mb-2">Related Items</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* TODO: fetch & render related media via /media?tags= or /media?person_id= */}
                    </div>
                </section>
            </main>
        </div>
    )
}
