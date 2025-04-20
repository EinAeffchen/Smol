import React, { useState, useEffect, FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Person, Media, Face } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function PersonDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [person, setPerson] = useState<Person | null>(null)
    const [faces, setFaces] = useState<Face[]>([])
    const [form, setForm] = useState({
        name: '',
        age: '',
        gender: '',
        ethnicity: '',
    })

    // Load person + their faces
    useEffect(() => {
        if (!id) return

        // 1) fetch person metadata
        fetch(`${API}/persons/${id}`)
            .then(res => res.json())
            .then((p: Person) => {
                setPerson(p)
                setForm({
                    name: p.name || '',
                    age: p.age?.toString() || '',
                    gender: p.gender || '',
                    ethnicity: p.ethnicity || '',
                })
            })

        // 2) fetch all media with this person, then extract faces
        fetch(`${API}/media?person_id=${id}`)
            .then(res => res.json())
            .then((medias: Media[]) => {
                const fs: Face[] = medias.flatMap(m =>
                    m.faces
                        .filter(f => f.person?.id?.toString() === id)
                        .map(f => ({
                            ...f,
                            // attach thumbnail URL
                            thumbnail_path: f.thumbnail_path,
                        }))
                )
                setFaces(fs)
            })
    }, [id])

    if (!person) return <div className="p-4">Loading…</div>

    // Handle metadata save
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const payload = {
            name: form.name,
            age: parseInt(form.age),
            gender: form.gender,
            ethnicity: form.ethnicity,
        }
        const res = await fetch(`${API}/persons/${id}`, {
            method: 'PUT',    // you’ll need to add this endpoint in the API
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        if (res.ok) {
            const updated = await res.json()
            setPerson(updated)
            alert('Person updated')
        } else {
            alert('Failed to update person')
        }
    }

    return (
        <div className="bg-background text-text min-h-screen">
            <header className="flex items-center p-4 space-x-4">
                <Link to="/" className="text-accent hover:underline">← Back</Link>
                <h1 className="text-2xl font-semibold">
                    Person #{person.id}
                </h1>
            </header>

            <main className="p-4 space-y-8 max-w-3xl mx-auto">
                {/* — Metadata Form — */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm">Name</label>
                        <input
                            type="text" value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-800 rounded"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm">Age</label>
                            <input
                                type="number" value={form.age}
                                onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Gender</label>
                            <input
                                type="text" value={form.gender}
                                onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 rounded"
                            />
                        </div>
                        <div>
                            <label className="block text-sm">Ethnicity</label>
                            <input
                                type="text" value={form.ethnicity}
                                onChange={e => setForm(f => ({ ...f, ethnicity: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-800 rounded"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-accent rounded hover:bg-accent2 text-background"
                    >
                        Save
                    </button>
                </form>

                {/* — Matched Faces — */}
                <section>
                    <h2 className="text-xl font-semibold mb-4">Matched Faces</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {faces.map(f => (
                            <div key={f.id} className="relative">
                                <img
                                    src={`/thumbnails/${f.thumbnail_path}`}
                                    alt={`face ${f.id}`}
                                    className="w-full h-24 object-cover rounded"
                                />
                                {/* Unassign button */}
                                <button
                                    onClick={async () => {
                                        if (!confirm('Remove this face from the person?')) return
                                        // call your API to reassign face.person_id to null
                                        await fetch(`${API}/faces/${f.id}/assign`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ person_id: null }),
                                        })
                                        setFaces(fs => fs.filter(x => x.id !== f.id))
                                    }}
                                    className="absolute top-1 right-1 text-red-400 bg-black bg-opacity-50 p-1 rounded-full"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    )
}
