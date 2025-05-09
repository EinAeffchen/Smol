import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SimilarContent } from '../components/MediaRelatedContent'
import PersonCard from '../components/PersonCard'
import TagAdder from '../components/TagAdder'
import { Media, MediaDetail, Person, Face, Task, SceneRead } from '../types'
import { Tags } from '../components/Tags'
import { VideoWithPreview } from '../components/VideoPlayer'
import { useFaceActions } from '../hooks/useFaceActions'
import DetectedFaces from '../components/DetectedFaces'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function VideoDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [media, setMedia] = useState<Media | null>(null)
    const [matchedPersons, setMatchedPersons] = useState<Person[]>([])
    const [orphanFaces, setOrphanFaces] = useState<Face[]>([])
    const [scenes, setScenes] = useState<SceneRead[]>([])

    const [task, setTask] = useState<Task | null>(null)

    const {
        assignFace,
        createPersonFromFace,
        deleteFace,
        setProfileFace,
    } = useFaceActions()

    const handleAssign = useCallback(
        async (faceId: number, personId: number) => {
            await assignFace(faceId, personId)
            // now remove from our local list
            setOrphanFaces((faces) => faces.filter(f => f.id !== faceId))
        },
        [assignFace]
    )
    const handleDelete = useCallback(
        async (faceId: number) => {
            await deleteFace(faceId)
            setOrphanFaces((faces) => faces.filter(f => f.id !== faceId))
        },
        [deleteFace]
    )
    // wrap create + navigate
    const handleCreate = useCallback(
        async (
            faceId: number,
            data: { name?: string; age?: number; gender?: string }
        ): Promise<Person> => {
            console.log(faceId);
            console.log(data);
            const newPerson = await createPersonFromFace(faceId, data);
            // remove that face from your local orphans array
            setOrphanFaces(fs => fs.filter(f => f.id !== faceId));
            // navigate to the newly created person’s detail page
            navigate(`/person/${newPerson.id}`);
            return newPerson;
        },
        [createPersonFromFace, navigate]
    );

    useEffect(() => {
        if (!id) return

            ; (async () => {
                const res = await fetch(`${API}/media/${id}`)
                const json = (await res.json()) as MediaDetail
                setMedia(json.media)
                setMatchedPersons(json.persons)    // <–– get them here!
                setOrphanFaces(json.orphans)    // <–– get them here!
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
                >
                    <div key={media.id}>
                        {media.duration != null ? (
                            <VideoWithPreview media={media} />
                        ) : (
                            <img class="w-full rounded shadow-lg" src={`${API}/originals/${media.path}`} alt={media.filename} />
                        )}
                    </div>

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
                <h1>Unassigned faces in this Video</h1>
                <DetectedFaces
                    faces={orphanFaces}
                    // if you have a currentPersonId you can highlight a profile face
                    onAssign={handleAssign}
                    onCreate={(faceId, data) => handleCreate(faceId, data)}
                    onDelete={handleDelete}
                    onSetProfile={() => alert("Can't set as profile for video!")}
                />
                <SimilarContent media={media} />

            </main>
        </div >
    )
}
