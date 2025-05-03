import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Person, Tag, MediaDetail, MediaPreview } from '../types'
import TagAdder from '../components/TagAdder'
import { SimilarContent } from '../components/MediaRelatedContent'
import { MediaExif } from '../components/MediaExif'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function ImageDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])

    const [showExif, setShowExif] = useState(false)

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

    // Handler: delete file
    async function handleDeleteFile() {
        if (!window.confirm(
            '⚠️ This will permanently delete the file and its thumbnail from disk. Continue?'
        )) return
        const res = await fetch(`${API}/media/${media.id}/file`, {
            method: 'DELETE'
        })
        if (res.ok) {
            alert('File deleted.')
            // reload metadata so thumbnail vanishes
            setMedia({ ...media, path: '', width: 0, height: 0 })
        } else {
            alert('Failed to delete file.')
        }
    }

    // Handler: delete record
    async function handleDeleteRecord() {
        if (!window.confirm(
            '⚠️ This will delete the database record (cannot be undone). Continue?'
        )) return
        const res = await fetch(`${API}/media/${media.id}`, {
            method: 'DELETE'
        })
        if (res.ok) {
            alert('Record deleted. Returning home.')
            navigate('/')
        } else {
            alert('Failed to delete record.')
        }
    }

    return (

        <div className="bg-background text-text min-h-screen">
            <header className="flex items-center p-4 space-x-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">{media.filename}</h1>
            </header>
            <div className="px-4 space-x-2">
                <button
                    onClick={handleDeleteFile}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                    Delete File
                </button>
                <button
                    onClick={handleDeleteRecord}
                    className="px-3 py-1 bg-red-800 hover:bg-red-900 text-white rounded"
                >
                    Delete Record
                </button>
            </div>
            <main className="p-4 space-y-8">
                {/* IMAGE  INFO ICON */}
                <figure
                    className="relative mx-auto max-w-xl"
                    onMouseEnter={() => setShowExif(true)}
                    onMouseLeave={() => setShowExif(false)}
                >
                    <img
                        src={`/originals/${media.path}`}
                        alt={media.filename}
                        className="w-full rounded shadow-lg"
                    />
                    <MediaExif showExif={showExif} id={media.id} />
                </figure>
                {/* Detected Persons */}
                <section>
                    <h3 className="text-lg font-semibold mb-2">Detected Persons</h3>
                    <div className="max-w-full overflow-x-auto py-2">
                        <div className="inline-flex space-x-4">
                            {(matchedPersons ?? []).map(p => (
                                <PersonCard person={p} />
                            ))}
                        </div>
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
                <SimilarContent media={media} />
            </main>
        </div >
    )
}
