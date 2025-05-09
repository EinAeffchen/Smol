import React, { useCallback } from 'react'
import PersonCard from '../components/PersonCard'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import { Person } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function VideosPage() {
    const fetchPeople = useCallback((cursor: string | null, limit: number) =>
        fetch(`${API}/persons/${cursor ? `?cursor=${cursor}&` : "?"
            }limit=${limit}`)
            .then(r => r.json() as Promise<CursorResponse<Person>>), [API])
    const { items: persons, setItems: setPersons, hasMore, loading, loaderRef } = useInfinite<Person>(fetchPeople, 12)

    if (loading) return <div className="p-4">Loading people...</div>

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">People</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                {(persons ?? []).map(person => (
                    <PersonCard key={person.id} person={person} />
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
        </div>
    )
}
