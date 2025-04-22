// src/components/ProcessorPanel.tsx
import React, { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE_URL

export default function ProcessorPanel({ mediaId }: { mediaId: number }) {
    const [names, setNames] = useState<string[]>([])
    const [data, setData] = useState<Record<string, any>>({})

    useEffect(() => {
        fetch(`${API}/media/${mediaId}/processors`)
            .then(r => r.json())
            .then(setNames)
    }, [mediaId])

    useEffect(() => {
        names.forEach(name =>
            fetch(`${API}/media/${mediaId}/processors/${name}`)
                .then(r => r.json())
                .then(d => setData(prev => ({ ...prev, [name]: d })))
                .catch(console.error)
        )
    }, [names, mediaId])

    if (!names.length) return null

    return (
        <section className="mb-8">
            <h3 className="text-lg font-semibold mb-2">Processor Outputs</h3>
            {names.map(name => (
                <div key={name} className="mb-4">
                    <button
                        onClick={() => {
                            const el = document.getElementById(`proc-${name}`)
                            if (el) el.classList.toggle("hidden")
                        }}
                        className="px-2 py-1 bg-gray-700 rounded"
                    >
                        {name}
                    </button>
                    <pre
                        id={`proc-${name}`}
                        className="bg-gray-800 p-4 rounded mt-2 overflow-auto hidden text-sm"
                    >
                        {JSON.stringify(data[name], null, 2)}
                    </pre>
                </div>
            ))}
        </section>
    )
}
