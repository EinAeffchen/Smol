import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Person, Tag, MediaDetail } from '../types'
import TagAdder from '../components/TagAdder'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function ImageDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])

    useEffect(() => {
        if (!id) return
            ; (async () => {
                const res = await fetch(`${API}/media/${id}`)
                const { media, persons } = await res.json() as MediaDetail
                setMedia(media)
                setMatchedPersons(persons)
            })().catch(console.error)
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
                        {(matchedPersons ?? []).map(p => (
                            <PersonCard person={p} />
                        ))}
                    </div>
                </section>
                {/* Add tag to media */}
                <div className="px-4 py-2">
                    <TagAdder
                        ownerType="media"
                        ownerId={media.id}
                        existingTags={media.tags ?? []}
                        onTagAdded={tag => {
                            setMedia({
                                ...media,
                                tags: [...(media.tags ?? []), tag],
                            })
                        }}
                    />
                </div>
                {/* Tags */}
                <section>
                    <h2 className="text-xl font-semibold mb-2">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {(media.tags ?? []).map((tag: Tag) => (
                            <div key={tag.id} className="flex items-center bg-accent2 text-background px-3 py-1 rounded-full space-x-1">
                                <Link to={`/tag/${tag.id}`}>{tag.name}</Link>
                                <button
                                    onClick={async () => {
                                        await fetch(`${API}/media/${media.id}/${tag.id}`, { method: 'DELETE' })
                                        setMedia({
                                            ...media,
                                            tags: media.tags!.filter(t => t.id !== tag.id)
                                        })
                                    }}
                                    className="font-bold"
                                >×</button>
                            </div>
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
