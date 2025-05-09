// src/pages/PersonDetailPage.tsx
import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FaceCard from '../components/FaceCard'
import MediaCard from '../components/MediaCard'
import SimilarPersonCard from '../components/SimilarPersonCard'
import TagAdder from '../components/TagAdder'
import { FaceRead, Person, PersonDetail, SimilarPerson, Tag } from '../types'
import { useFaceActions } from '../hooks/useFaceActions'
import DetectedFaces from '../components/DetectedFaces'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function PersonDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<PersonDetail | null>(null)
    const [loading, setLoading] = useState(true)

    // form state for editing person
    const [form, setForm] = useState({ name: '', age: '' as string | number, gender: '' })
    const [saving, setSaving] = useState(false)

    // merge modal state
    const [mergeOpen, setMergeOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [candidates, setCandidates] = useState<Person[]>([])

    // Similarity measures
    const [similar, setSimilar] = useState<SimilarPerson[]>([])
    const [richSimilar, setRichSimilar] = useState<SimilarPerson[]>([])
    const [loadingSim, setLoadingSim] = useState(false)

    // Assign orphan faces
    const [suggestedFaces, setSuggestedFaces] = useState<FaceRead[]>([])

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
            setSuggestedFaces((faces) => faces.filter(f => f.id !== faceId))
            loadDetail()
        },
        [assignFace]
    )
    const handleDelete = useCallback(
        async (faceId: number) => {
            await deleteFace(faceId)
            setSuggestedFaces((faces) => faces.filter(f => f.id !== faceId))
            loadDetail()
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
            setSuggestedFaces(fs => fs.filter(f => f.id !== faceId));
            loadDetail()
            // navigate to the newly created person’s detail page
            navigate(`/person/${newPerson.id}`);
            return newPerson;
        },
        [createPersonFromFace, navigate]
    );

    const loadSuggestedFaces = useCallback(async () => {
        if (!id) return
        try {
            const res = await fetch(`${API}/persons/${id}/suggest-faces`)
            if (!res.ok) throw new Error("Failed to load suggestions")
            const data = (await res.json()) as FaceRead[]
            setSuggestedFaces(data)
        } catch (err) {
            console.error(err)
        }
    }, [id])

    // fetch stored similarities on mount
    async function loadSimilar() {
        if (!id) return
        setLoadingSim(true)
        const res = await fetch(`${API}/persons/${id}/similarities`)
        if (res.ok) {
            setSimilar(await res.json())
        }
        setLoadingSim(false)
    }

    useEffect(() => {
        if (similar.length === 0) {
            setRichSimilar([])
            return
        }

        Promise.all(similar.map(async (p) => {
            // fetch the PersonDetail so we can grab profile_face
            const res = await fetch(`${API}/persons/${p.id}`)
            if (!res.ok) return p
            const detail = await res.json() as PersonDetail
            return {
                ...p,
                name: detail.person.name ?? p.name,
                thumbnail: detail.person.profile_face?.thumbnail_path
            }
        })).then(setRichSimilar)
            .catch(console.error)
    }, [similar])

    useEffect(() => {
        loadSimilar()
    }, [id])

    // 1) Load the full PersonDetail on mount / id change
    useEffect(() => {
        if (!id) return
        fetch(`${API}/persons/${id}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to fetch')
                return r.json()
            })
            .then((d: PersonDetail) => {
                setDetail(d)
                setForm({
                    name: d.person.name ?? '',
                    age: d.person.age ?? '',
                    gender: d.person.gender ?? '',
                })
            })
            .catch(console.error)
            .finally(() => setLoading(false))
        loadSuggestedFaces()
    }, [id])

    useEffect(() => {
        if (!id) return
        fetch(`${API}/persons/${id}/suggest-faces`)
            .then(r => r.json())
            .then(setSuggestedFaces)
            .catch(console.error)
    }, [id])

    // 2) Form handlers
    function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target
        setForm(f => ({ ...f, [name]: value }))
    }

    const loadDetail = useCallback(async () => {
        if (!id) return
        const res = await fetch(`${API}/persons/${id}`)
        if (!res.ok) throw new Error("couldn’t load detail")
        setDetail(await res.json())
    }, [id])


    useEffect(() => {
        loadDetail()
        loadSuggestedFaces()
    }, [id])

    async function onSave(e: FormEvent) {
        e.preventDefault()
        if (!id) return
        setSaving(true)
        try {
            const payload: any = {
                name: form.name,
                gender: form.gender,
            }
            if (form.age !== '') payload.age = Number(form.age)

            const res = await fetch(`${API}/persons/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error(await res.text())
            const updated: PersonDetail = await res.json()
            setDetail(d =>
                d
                    ? {
                        ...d,
                        person: {
                            // keep existing nested data (profile_face, tags, etc.)
                            ...d.person,
                            // overwrite only the top‑level fields returned by the PATCH
                            ...updated,
                        }
                    }
                    : d
            )
            alert('Saved successfully')
        } catch (err) {
            console.error(err)
            alert('Save failed')
        } finally {
            setSaving(false)
        }
    }

    // 3) Merge modal — search
    useEffect(() => {
        if (!mergeOpen || !searchTerm.trim()) {
            setCandidates([])
            return
        }
        fetch(`${API}/persons/?name=${encodeURIComponent(searchTerm)}`)
            .then(r => r.json())
            .then(r => setCandidates(r.items))
            .catch(console.error)
    }, [mergeOpen, searchTerm])

    async function doMerge(targetId: number) {
        if (!id) return
        const sourceId = Number(id)
        if (sourceId === targetId) return
        await fetch(`${API}/persons/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: sourceId, target_id: targetId })
        })
        navigate(`/person/${targetId}`, { replace: true })
    }

    if (loading ?? !detail) return <div className="p-4">Loading…</div>
    const { person, faces, medias } = detail

    async function handleRefreshSims() {
        if (!id) return
        setLoadingSim(true)
        await fetch(`${API}/persons/${id}/refresh-similarities`, {
            method: 'POST'
        })
        // give the background a moment, then reload
        setTimeout(loadSimilar, 500)
    }

    return (
        <div className="bg-background text-text min-h-screen">
            {/* === CONTROLS BAR === */}
            <div className="max-w-screen-lg mx-auto px-4 flex items-center space-x-4 py-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">{person.name || 'Unnamed'}</h1>

                <div className="ml-auto flex space-x-2">
                    <button
                        onClick={() => setMergeOpen(true)}
                        className="px-3 py-1 bg-accent text-sm rounded hover:bg-accent2"
                    >Merge</button>
                    <button
                        onClick={handleRefreshSims}
                        disabled={loadingSim}
                        className="px-3 py-1 bg-accent text-sm rounded hover:bg-accent2"
                    >
                        {loadingSim ? 'Refreshing…' : 'Refresh Similar'}
                    </button>
                    <button
                        onClick={async () => {
                            if (!confirm('Delete this person?')) return
                            const res = await fetch(`${API}/persons/${person.id}`, { method: 'DELETE' })
                            if (res.ok) navigate('/', { replace: true })
                            else alert('Delete failed')
                        }}
                        className="px-3 py-1 bg-red-600 text-sm rounded hover:bg-red-700"
                    >Delete</button>
                </div>
            </div>

            <main className="max-w-screen-lg mx-auto px-4 space-y-8">

                {/* === PROFILE & EDIT === */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Profile Face */}
                    <div className="flex flex-col items-center">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-accent mb-2">
                            <img
                                src={`${API}/thumbnails/${person.profile_face?.thumbnail_path}`}
                                alt="Profile"
                                className="object-cover w-full h-full"
                            />
                        </div>
                        <span className="font-medium">Profile Face</span>
                    </div>

                    {/* Edit Form (span 2 cols on md) */}
                    <form
                        onSubmit={onSave}
                        className="md:col-span-2 bg-gray-800 p-4 rounded-lg shadow space-y-4"
                    >
                        <h2 className="text-lg font-semibold">Edit Profile</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-1">Name</label>
                                <input
                                    name="name" value={form.name}
                                    onChange={onChange}
                                    className="w-full px-2 py-1 rounded bg-gray-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Age</label>
                                <input
                                    name="age" type="number" min="0"
                                    value={form.age}
                                    onChange={onChange}
                                    className="w-full px-2 py-1 rounded bg-gray-700"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm mb-1">Gender</label>
                                <select
                                    name="gender"
                                    value={form.gender}
                                    onChange={onChange}
                                    className="w-full px-2 py-1 rounded bg-gray-700"
                                >
                                    <option value="">— select —</option>
                                    <option>male</option>
                                    <option>female</option>
                                    <option>other</option>
                                </select>
                            </div>
                        </div>

                        <div className="text-right">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-1 bg-accent rounded text-background hover:bg-accent2"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>


                {/* === TAGS === */}
                <div className="bg-gray-800 p-4 rounded-lg shadow space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Tags</h2>
                        <TagAdder
                            ownerType="persons"
                            ownerId={person.id}
                            existingTags={person.tags ?? []}
                            onTagAdded={(tag) =>
                                setDetail((d) =>
                                    d
                                        ? {
                                            ...d,
                                            person: {
                                                ...d.person,
                                                tags: [...(d.person.tags ?? []), tag],
                                            },
                                        }
                                        : d
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(person.tags ?? []).map((tag: Tag) => (
                            <div
                                key={tag.id}
                                className="flex items-center bg-accent2 text-background px-3 py-1 rounded-full space-x-1 text-sm"
                            >
                                <Link to={`/tag/${tag.id}`}>{tag.name}</Link>
                                <button
                                    onClick={async () => {
                                        await fetch(`${API}/tags/persons/${person.id}/${tag.id}`, { method: 'DELETE' })
                                        setDetail((d) =>
                                            d
                                                ? {
                                                    ...d,
                                                    person: {
                                                        ...d.person,
                                                        tags: d.person.tags!.filter((t) => t.id !== tag.id),
                                                    },
                                                }
                                                : d
                                        );
                                    }}
                                >×</button>
                            </div>
                        ))}
                    </div>
                </div>


                {/* === MEDIA GRID === */}
                <section>
                    <h2 className="text-lg font-semibold mb-2">Media Appearances</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                        {medias.map(m => <MediaCard key={m.id} media={m} />)}
                    </div>
                </section>


                <DetectedFaces
                    faces={faces}
                    // if you have a currentPersonId you can highlight a profile face
                    profileFaceId={person.id}
                    onAssign={assignFace}
                    onCreate={(faceId, data) => handleCreate(faceId, data)}
                    onDelete={deleteFace}
                    onSetProfile={faceId => setProfileFace(faceId, /* personId */ 42)}
                />
                {/* Suggestions (“Is this the same person?”) */}
                {suggestedFaces.length > 0 && (
                    <DetectedFaces
                        faces={suggestedFaces}
                        // no profile highlighting in suggestions:
                        onSetProfile={() => { }}
                        onAssign={handleAssign}
                        onCreate={(faceId, data) => handleCreate(faceId, data)}
                        onDelete={handleDelete}
                        horizontal
                    />
                )}

                {/* === SIMILAR PEOPLE === */}
                <section>
                    <h2 className="text-lg font-semibold mb-2">Similar People</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                        {richSimilar.map(p => (
                            <SimilarPersonCard
                                key={p.id}
                                id={p.id}
                                name={p.name}
                                similarity={p.similarity}
                                thumbnail={p.thumbnail}
                            />
                        ))}
                    </div>
                </section>

            </main>

            {/* Merge Modal */}
            {
                mergeOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30">
                        <div className="bg-gray-800 p-6 rounded-lg w-96 space-y-4">
                            <h4 className="text-lg font-semibold">
                                Merge "{person.name}" into…
                            </h4>
                            <input
                                type="text"
                                placeholder="Search by name…"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 rounded bg-gray-700"
                            />
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {candidates.map(c => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between p-2 bg-gray-900 rounded hover:bg-gray-700 cursor-pointer"
                                        onClick={() => doMerge(c.id)}
                                    >
                                        <span>{c.name ?? 'Unknown'}</span>
                                        <span className="text-accent">Merge →</span>
                                    </div>
                                ))}
                                {searchTerm && candidates.length === 0 && (
                                    <div className="italic text-gray-500">No matches</div>
                                )}
                            </div>
                            <button
                                className="mt-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                                onClick={() => setMergeOpen(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
