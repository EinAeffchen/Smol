// frontend/src/pages/TagDetailPage.tsx
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Media, Person, Tag } from '../types'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function TagDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [tag, setTag] = useState<Tag | null>(null)

    useEffect(() => {
        if (!id) return
        fetch(`${API}/tags/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Tag not found")
                return res.json()
            })
            .then((t: Tag) => setTag(t))
            .catch(console.error)
    }, [id])

    if (!tag) return <div className="p-4">Loading…</div>

    return (
        <div className="bg-background text-text min-h-screen p-6">
            <h1 className="text-3xl font-semibold mb-4">Tag: #{tag.name}</h1>

            <section className="mb-12">
                <h2 className="text-2xl font-medium mb-2">Media</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(tag.media ?? []).map((m: Media) => (
                        <MediaCard key={m.id} media={m} />
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-medium mb-2">People</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                    {(tag.persons ?? []).map((p: Person) => (
                        <Link to={`/person/${p.id}`} key={p.id}>
                            <PersonCard person={p} />
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    )
}
