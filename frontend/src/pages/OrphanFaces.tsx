import React, { useCallback, useState } from 'react'
import FaceCard from '../components/FaceCard'
import { FaceRead } from '../types'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'


const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function OrphanFacesPage() {
    const fetchOrphans = useCallback(
        (cursor: string | null, limit: number) =>
            fetch(
                `${API}/faces/orphans${cursor ? `?cursor=${cursor}&` : "?"
                }limit=${limit}`
            ).then((r) =>
                r.json() as Promise<CursorResponse<FaceRead>>
            ),
        [API]
    )
    const {
        items: orphans,
        setItems: setOrphans,
        hasMore,
        loading,
        loaderRef,
    } = useInfinite<FaceRead>(fetchOrphans, 48, []);


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
                {loading && (
                    <div className="py-4 text-center text-gray-500">
                        Loading…
                    </div>
                )}
                {!loading && hasMore && (
                    <div
                        ref={loaderRef}
                        className="py-4 text-center text-gray-500"
                    >
                        Scroll to load more…
                    </div>
                )}
            </section>
        </main>
    )
}
