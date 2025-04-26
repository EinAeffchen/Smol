import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Person, Tag, Face, MediaDetail } from '../types'
import TagAdder from '../components/TagAdder'



const API = import.meta.env.VITE_API_BASE_URL || ''

export default function VideoDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])

    const [showExif, setShowExif] = useState(false)
    const [exif, setExif] = useState<any>(null)
    const [loadingExif, setLoadingExif] = useState(false)

    useEffect(() => {
        if (!id) return
            ; (async () => {
                const res = await fetch(`${API}/media/${id}`)
                const { media, persons } = await res.json() as MediaDetail
                setMedia(media)
                setMatchedPersons(persons)
            })().catch(console.error)
    }, [id])

    useEffect(() => {
        if (showExif && exif === null && !loadingExif) {
            setLoadingExif(true)
            fetch(`${API}/media/${id}/processors/exif`)
                .then(r => r.ok ? r.json() : null)
                .then(data => setExif(data))
                .catch(() => setExif({}))
                .finally(() => setLoadingExif(false))
        }
    }, [showExif])

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
                {/* Video Player */}
                <video
                    controls
                    className="w-full max-h-[60vh] rounded-lg bg-black mx-auto"
                    src={`/originals/${media.path}`}
                />
                {/* IMAGE  INFO ICON */}
                <div className="relative inline-block">
                    <img
                        src={`/thumbnails/${media.id}.jpg`}
                        alt={media.filename}
                        className="max-w-full rounded"
                    />
                    <button
                        onMouseEnter={() => setShowExif(true)}
                        onMouseLeave={() => setShowExif(false)}
                        className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-1"
                        title="Show EXIF info"
                    >ℹ️</button>

                    {/* EXIF TOOLTIP */}
                    {showExif && exif && (
                        <div className="absolute top-10 right-2 w-64 bg-white text-black text-xs p-2 rounded shadow-lg z-20">
                            {loadingExif
                                ? <p>Loading…</p>
                                : (
                                    <>
                                        {exif.make && <p><strong>Camera:</strong> {exif.make} {exif.model}</p>}
                                        {exif.timestamp && <p><strong>Shot:</strong> {new Date(exif.timestamp).toLocaleString()}</p>}
                                        {exif.iso && <p><strong>ISO:</strong> {exif.iso}</p>}
                                        {exif.exposure_time && <p><strong>Shutter:</strong> {exif.exposure_time}s</p>}
                                        {exif.aperture && <p><strong>Aperture:</strong> {exif.aperture}</p>}
                                        {exif.focal_length && <p><strong>Focal:</strong> {exif.focal_length} mm</p>}

                                        {/* link to map if GPS exists */}
                                        {(exif.lat && exif.lon) && (
                                            <Link
                                                to={`/map?focus=${media.id}`}
                                                className="mt-2 inline-block text-blue-600 hover:underline"
                                            >
                                                View on map 📍
                                            </Link>
                                        )}
                                    </>
                                )}
                        </div>
                    )}
                </div>
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
                        existingTags={media.tags || []}
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


                {/* Related (stub; implement via your /media?person_id=… or /media?tags=…) */}
                <section>
                    <h2 className="text-xl font-semibold mb-2">Related Videos</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* TODO: fetch & map related videos */}
                    </div>
                </section>
            </main>
        </div>
    )
}
