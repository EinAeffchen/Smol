import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Person, Tag, MediaDetail } from '../types'
import TagAdder from '../components/TagAdder'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function ImageDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])

    const [showExif, setShowExif] = useState(false)
    const [exif, setExif] = useState<Record<string, any> | null | undefined>(undefined)

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
        if (showExif && exif === undefined) {
            fetch(`${API}/api/media/${id}/processors/exif`)
                .then(r => (r.ok ? r.json() : null))
                .then(body => setExif(body))       // body is object or null
                .catch(() => setExif(null))
        }
    }, [showExif, id])


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
                    {/* only render overlay when showExif===true */}
                    {showExif && (
                        <div className="absolute inset-0 pointer-events-none transition-opacity opacity-100">
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-4 max-h-1/3 overflow-auto pointer-events-auto">
                                {
                                    // 2.1 still loading?
                                    exif === undefined ? (
                                        <p>Loading EXIF…</p>
                                    ) : (
                                        <>
                                            {
                                                // 2.2 we got an object → render fields
                                                exif && typeof exif === 'object' ? (
                                                    <>
                                                        {exif.make && <p><strong>Camera:</strong> {exif.make} {exif.model}</p>}
                                                        {exif.timestamp && <p><strong>Shot:</strong> {new Date(exif.timestamp).toLocaleString()}</p>}
                                                        {exif.iso && <p><strong>ISO:</strong> {exif.iso}</p>}
                                                        {exif.exposure_time && <p><strong>Shutter:</strong> {exif.exposure_time}s</p>}
                                                        {exif.aperture && <p><strong>Aperture:</strong> {exif.aperture}</p>}
                                                        {exif.focal_length && <p><strong>Focal:</strong> {exif.focal_length} mm</p>}

                                                        {exif.lat != null && exif.lon != null && (
                                                            <Link
                                                                to={`/map?focus=${media.id}`}
                                                                className="mt-2 inline-block text-blue-300 hover:underline pointer-events-auto"
                                                            >
                                                                View on map 📍
                                                            </Link>
                                                        )}
                                                    </>
                                                ) : (
                                                    // 2.3 exif===null or non-object → no data
                                                    <p>No EXIF data available.</p>
                                                )
                                            }
                                        </>
                                    )
                                }
                            </div>
                        </div>
                    )}
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


                {/* Related */}
                <section>
                    <h2 className="text-xl font-semibold mb-2">Related Items</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* TODO: fetch & render related media via /media?tags= or /media?person_id= */}
                    </div>
                </section>
            </main>
        </div >
    )
}
