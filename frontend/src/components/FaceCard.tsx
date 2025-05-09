// src/components/FaceCard.tsx
import React, { useState, useEffect } from "react"
import { Face, Person } from "../types"


const API = import.meta.env.VITE_API_BASE_URL ?? ""

export default function FaceCard({
    face,
    isProfile,
    onSetProfile,
    onAssign,
    onCreate,
    onDelete
}: {
    face: Face
    isProfile: boolean
    onSetProfile: () => void
    onAssign: (personId: number) => void
    onCreate: (data: {
        name?: string
        age?: number
        gender?: string
    }) => void
    onDelete: () => void
}) {
    const [mode, setMode] = useState<"menu" | "search" | "new">("menu")
    const [query, setQuery] = useState("")
    const [cands, setCands] = useState<Person[]>([])
    const [form, setForm] = useState({
        name: "",
        age: "",
        gender: "",
    })

    // whenever we enter “search” mode and have a query, fetch matches
    useEffect(() => {
        if (mode !== "search" || !query.trim()) {
            setCands([])
            return
        }
        fetch(`${API}/persons/?name=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(r => setCands(r.items))
            .catch(console.error)
    }, [mode, query])

    // assign to an existing person
    async function assignTo(pid: number) {
        await fetch(`${API}/faces/${face.id}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ person_id: pid }),
        })
        onAssign(pid)
    }

    // create a new person + assign
    async function createAssign() {
        const payload: any = {}
        if (form.name) payload.name = form.name
        if (form.age) payload.age = Number(form.age)
        if (form.gender) payload.gender = form.gender

        await onCreate(payload)
    }

    return (
        <div className="relative w-32 flex-shrink-0">
            <button
                onClick={() => {
                    if (confirm("Delete this face?")) onDelete()
                }}
                className="absolute top-1 left-1 text-red-500 bg-black bg-opacity-50 rounded-full p-1 text-xs"
                title="Delete face"
            >
                🗑️
            </button>
            {/* face thumbnail */}
            <a href={`/video/${face.media_id}`}>
                <img
                    src={`${API}/thumbnails/${face.thumbnail_path}`}
                    alt="face"
                    className={`rounded-lg object-cover w-full h-32 ${isProfile ? "ring-4 ring-accent" : ""
                        }`}
                />
            </a>

            {/* star to pick as profile (if not already) */}
            {!isProfile && (
                <button
                    onClick={onSetProfile}
                    className="absolute top-1 right-1 bg-accent p-1 rounded-full text-xs"
                    title="Set as profile"
                >
                    ★
                </button>
            )}

            {/* action menu */}
            {mode === "menu" && !face.person && (
                <div className="mt-1 flex justify-center space-x-2 text-xs">
                    <button
                        onClick={() => setMode("search")}
                        className="px-1 py-0.5 bg-gray-700 rounded"
                    >
                        Assign
                    </button>
                    <button
                        onClick={() => setMode("new")}
                        className="px-1 py-0.5 bg-gray-700 rounded"
                    >
                        New
                    </button>
                </div>
            )}

            {/* SEARCH EXISTING */}
            {mode === "search" && (
                <div className="mt-1 text-xs space-y-1">
                    <input
                        type="text"
                        placeholder="Search…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full px-1 py-0.5 rounded bg-gray-700"
                    />
                    <div className="max-h-24 overflow-auto space-y-1">
                        {cands.length > 0 ? (
                            cands.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => assignTo(p.id)}
                                    className="px-1 py-0.5 rounded cursor-pointer hover:bg-gray-600"
                                >
                                    {p.name ?? "Unknown"}
                                </div>
                            ))
                        ) : (
                            <div className="italic text-gray-500">
                                {query.trim() ? "No matches" : "Type to search"}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setMode("menu")}
                        className="text-xs text-gray-400 underline"
                    >
                        ← back
                    </button>
                </div>
            )}

            {/* CREATE NEW */}
            {mode === "new" && (
                <div className="mt-1 text-xs space-y-1">
                    {["name", "age", "gender"].map((field) => (
                        <input
                            key={field}
                            name={field}
                            placeholder={field}
                            value={(form as any)[field]}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, [field]: e.target.value }))
                            }
                            className="w-full px-1 py-0.5 rounded bg-gray-700"
                        />
                    ))}
                    <button
                        onClick={createAssign}
                        className="w-full px-1 py-0.5 bg-accent rounded"
                    >
                        Create & Assign
                    </button>
                    <button
                        onClick={() => setMode("menu")}
                        className="w-full text-gray-400 underline"
                    >
                        ← back
                    </button>
                </div>
            )}
        </div>
    )
}
