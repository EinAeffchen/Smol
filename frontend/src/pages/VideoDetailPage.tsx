import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MediaExif } from '../components/MediaExif'
import { SimilarContent } from '../components/MediaRelatedContent'
import PersonCard from '../components/PersonCard'
import TagAdder from '../components/TagAdder'
import { Media, MediaDetail, Person, Task, SceneRead } from '../types'
import { Tags } from '../components/Tags'
import { VideoWithPreview } from '../components/VideoPlayer'
import { VideoWithScenes } from '../components/VideoWithScenes'
const API = import.meta.env.VITE_API_BASE_URL || ''

export default function VideoDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])
    const [scenes, setScenes] = useState<SceneRead[]>([])

    const [showExif, setShowExif] = useState(false)
    const [task, setTask] = useState<Task | null>(null)


    useEffect(() => {
        if (!id) return

            ; (async () => {
                const res = await fetch(`${API}/media/${id}`)
                const json = (await res.json()) as MediaDetail
                setMedia(json.media)
                setMatchedPersons(json.persons)    // <–– get them here!
            })().catch(console.error)
    }, [id])

    useEffect(() => {
        if (!task) return
        const iv = setInterval(async () => {
            const res = await fetch(`${API}/tasks/${task.id}`)
            if (!res.ok) {
                clearInterval(iv)
                return
            }
            const updated: Task = await res.json()
            setTask(updated)
            if (updated.status !== "running") {
                clearInterval(iv)
                window.location.reload()
            }
        }, 1000)
        return () => clearInterval(iv)
    }, [task])

    useEffect(() => {
        fetch(`${API}/media/${id}/scenes`)
            .then(r => r.json())
            .then(setScenes)
    }, [id])

    if (!media) return <div>Loading…</div>

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

    async function handleConversion() {
        if (!confirm("⚠️ This might break your file, make sure to create a copy first. Continue?")) return

        const res = await fetch(`${API}/api/media/${media.id}/converter`, {
            method: "POST",
        })
        if (!res.ok) {
            alert("Failed to start conversion")
            return
        }
        const t: Task = await res.json()
        setTask(t)
    }

    return (
        <div className="bg-background text-text min-h-screen">
            <header className="flex items-center p-4 space-x-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">{media.filename}</h1>
            </header>

            <div className="px-4 space-x-2">
                <button
                    onClick={handleConversion}
                    className="px-3 py-1 bg-red-800 hover:bg-red-900 text-white rounded"
                >
                    Convert Video format
                </button>
                <button
                    onClick={handleDeleteRecord}
                    className="px-3 py-1 bg-red-800 hover:bg-red-900 text-white rounded"
                >
                    Delete Record
                </button>
                <button
                    onClick={handleDeleteFile}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                    Delete File from disk
                </button>
                {task && (
                    <div className="mt-4">
                        <div>Status: {task.status}</div>
                        <progress
                            className="w-full"
                            value={task.processed}
                            max={task.total}
                        />
                    </div>
                )}
            </div>

            <main className="p-4 space-y-8">
                {/* Video Player */}
                <figure
                    className="relative mx-auto max-w-xl"
                    onMouseEnter={() => setShowExif(true)}
                    onMouseLeave={() => setShowExif(false)}
                >
                    <div key={media.id}>
                        <VideoWithPreview
                            media={media}
                        />
                    </div>
                    {/* <MediaExif showExif={showExif} id={media.id} /> */}
                </figure>
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
                Add tag to media
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

                <Tags media={media} onUpdate={setMedia} />
                <SimilarContent media={media} />

            </main>
        </div >
    )
}
