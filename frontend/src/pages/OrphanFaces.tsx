import React, { useState, useEffect } from 'react'
import FaceCard from '../components/FaceCard'
import { Person, FaceRead } from '../types'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function OrphanFacesPage() {
    const [orphans, setOrphans] = useState<FaceRead[]>([])
    const [loading, setLoading] = useState(true)

    // 1) Load all orphan faces
    useEffect(() => {
        fetch(`${API}/faces/orphans`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load orphans')
                return r.json() as Promise<FaceRead[]>
            })
            .then(setOrphans)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    // assign a face to an existing person
    async function assignFace(faceId: number, personId: number) {
        await fetch(`${API}/faces/${faceId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_id: personId })
        }).then(() => {
            setOrphans(o => o.filter(f => f.id !== faceId))
        })
    }

    // create a new person from a face
    async function createPersonFromFace(faceId: number, data: any) {
        await fetch(`${API}/faces/${faceId}/create_person`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
            .then(r => r.json())
            .then((json: any) => {
                const p = json.person ?? json
                window.location.href = `/person/${p.id}`
            });
    }

    // delete a face entirely
    async function deleteFace(faceId: number) {
        await fetch(`${API}/faces/${faceId}`, { method: 'DELETE' })
            .then(() => setOrphans(o => o.filter(f => f.id !== faceId)))
    }

    if (loading) return <div className="p-4">Loading…</div>
    if (orphans.length === 0) return <div className="p-4">No unassigned faces.</div>

    return (
        <main className="max-w-screen-lg mx-auto px-4 space-y-8">
            {/* === DETECTED FACES === */}
            <section>
                <h2 className="text-lg font-semibold mb-2">Unassigned Faces</h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                    {orphans.map(face => (
                        <FaceCard
                            key={face.id}
                            face={face}
                            isProfile={false}
                            onSetProfile={() => { }}
                            onAssign={pid => assignFace(face.id, pid)}
                            onCreate={data => createPersonFromFace(face.id, data)}
                            onDelete={() => deleteFace(face.id)}
                        />
                    ))}
                </div>
            </section>
        </main>
    )
}
