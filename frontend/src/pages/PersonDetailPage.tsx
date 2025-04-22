// src/pages/PersonDetailPage.tsx
import React, { useState, useEffect, FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import FaceCard from '../components/FaceCard'
import { Header } from '../components/Header'
import { Person, PersonDetail, Tag, SimilarPerson } from '../types'
import TagAdder from '../components/TagAdder'
import SimilarPersonCard from '../components/SimilarPersonCard'

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
    }, [id])

    // 2) Form handlers
    function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target
        setForm(f => ({ ...f, [name]: value }))
    }

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
            .then(setCandidates)
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

    // assign a face to an existing person
    async function assignFace(faceId: number, personId: number) {
        await fetch(`${API}/faces/${faceId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_id: personId })
        })
        // remove that face from this profile's carousel
        setDetail(d => ({
            ...d!,
            faces: d!.faces.filter(f => f.id !== faceId)
        }))
    }

    // create a new person from a face
    async function createPersonFromFace(faceId: number, data: any): Promise<Person> {
        const res = await fetch(`${API}/faces/${faceId}/create_person`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        console.log("⚙️ create_person response JSON:", json);

        // unwrap it safely
        const p: Person =
            // if it’s the wrapper { person: Person, … }  
            (json as any).person
            // else if it’s bare Person  
            ?? (json as Person);
        console.log("⚙️ unwrapped Person:", p);

        if (!p?.id) {
            console.error("🚨 no p.id!");
            throw new Error("createPersonFromFace: could not extract person.id");
        }

        navigate(`/person/${p.id}`, { replace: true });
        return p;
    }

    // delete a face entirely
    async function deleteFace(faceId: number) {
        const res = await fetch(`${API}/faces/${faceId}`, { method: 'DELETE' })
        if (!res.ok) {
            alert('Failed to delete face')
            return
        }
        setDetail(d => ({
            ...d!,
            faces: d!.faces.filter(f => f.id !== faceId)
        }))
    }

    // set a face as the profile picture
    async function setProfileFace(faceId: number) {
        if (!id) return
        await fetch(`${API}/persons/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_face_id: faceId })
        })
        // refresh PersonDetail
        const d: PersonDetail = await fetch(`${API}/persons/${id}`).then(r => r.json())
        setDetail(d)
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
            <Header />

            <header className="flex items-center p-4 space-x-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">{person.name ?? 'Unnamed'}</h1>
                <button
                    onClick={() => setMergeOpen(true)}
                    className="ml-auto px-3 py-1 bg-accent rounded hover:bg-accent2"
                >
                    Merge with…
                </button>
                <button
                    onClick={async () => {
                        if (!window.confirm(
                            '⚠️ This will delete the person and all their faces. Continue?'
                        )) return;
                        const res = await fetch(`${API}/persons/${person.id}`, {
                            method: 'DELETE'
                        });
                        if (res.ok) {
                            alert('Person deleted.');
                            navigate('/', { replace: true });
                        } else {
                            alert('Failed to delete person.');
                        }
                    }}
                    className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                    Delete Person
                </button>
                <button
                    onClick={handleRefreshSims}
                    disabled={loadingSim}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2"
                >
                    {loadingSim ? 'Refreshing…' : 'Refresh Similar People'}
                </button>
            </header>

            <main className="max-w-4xl mx-auto p-4 space-y-8">

                {/* Profile Face */}
                <section className="text-center">
                    <h3 className="text-lg font-semibold mb-2">Profile Face</h3>
                    <div className="inline-block w-40 h-40 rounded-full overflow-hidden border-4 border-accent">
                        <img
                            src={`/thumbnails/${person.profile_face?.thumbnail_path}`}
                            alt="Profile face"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </section>

                {/* Edit Form */}
                <section className="bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>
                    <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm">Name</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={onChange}
                                className="w-full px-3 py-2 rounded bg-gray-700 focus:ring-accent"
                            />
                        </div>
                        {/* Age */}
                        <div>
                            <label className="block text-sm">Age</label>
                            <input
                                name="age" type="number" min="0"
                                value={form.age}
                                onChange={onChange}
                                className="w-full px-3 py-2 rounded bg-gray-700 focus:ring-accent"
                            />
                        </div>
                        {/* Gender */}
                        <div>
                            <label className="block text-sm">Gender</label>
                            <select
                                name="gender"
                                value={form.gender}
                                onChange={onChange}
                                className="w-full px-3 py-2 rounded bg-gray-700 focus:ring-accent"
                            >
                                <option value="">-- select --</option>
                                <option>male</option>
                                <option>female</option>
                                <option>other</option>
                            </select>
                        </div>
                        {/* Save */}
                        <div className="sm:col-span-2 text-right">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-accent hover:bg-accent2 rounded text-background"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Add tag to person */}
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

                {/* Tags */}
                <section className="mb-8">
                    <h2 className="text-2xl font-medium mb-2">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {(person.tags ?? []).map((tag: Tag) => (
                            <div
                                key={tag.id}
                                className="flex items-center bg-accent2 text-background px-3 py-1 rounded-full space-x-2"
                            >
                                <Link to={`/tag/${tag.id}`}>{tag.name}</Link>
                                {/* remove button */}
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
                                    className="font-bold"
                                >×</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Detected Faces Carousel */}
                <section>
                    <h3 className="text-lg font-semibold mb-2">Detected Faces</h3>
                    <div className="flex gap-4 overflow-x-auto py-2">
                        {faces.map(face => (
                            <FaceCard
                                face={face}
                                isProfile={face.id === person.profile_face_id}
                                onSetProfile={() => setProfileFace(face.id)}
                                onAssign={pid => assignFace(face.id, pid)}
                                onCreate={data => createPersonFromFace(face.id, data)}
                                onDelete={() => deleteFace(face.id)}
                            />
                        ))}
                    </div>
                </section>

                {/* Media Grid */}
                <section>
                    <h3 className="text-xl font-semibold mb-4">
                        Media Featuring {person.name}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {medias.map(m => <MediaCard key={m.id} media={m} />)}
                    </div>
                </section>
                {/* Similar People */}
                <section className="space-y-2">
                    <h3 className="text-lg font-semibold mb-2">Similar People</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
