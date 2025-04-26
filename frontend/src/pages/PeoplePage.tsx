import React, { useState, useEffect } from 'react'
import PersonCard from '../components/PersonCard'
import { Person } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function VideosPage() {
    const [persons, setPersons] = useState<Person[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/persons/`)
            .then(r => r.json())
            .then(setPersons)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-4">Loading peiple...</div>

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold mb-6">People</h1>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                {(persons ?? []).map(person => (
                    <PersonCard key={person.id} person={person} />
                ))}
            </div>
        </div>
    )
}
