import React, { useState, useEffect } from 'react'

type Task = {
    id: string
    task_type: 'scan' | 'extract_faces' | 'create_embeddings'
    status: 'pending' | 'running' | 'completed' | 'cancelled'
    total: number
    processed: number
}

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function TasksPanel() {
    const [tasks, setTasks] = useState<Task[]>([])

    // Fetch all tasks
    async function fetchTasks() {
        try {
            const res = await fetch(`${API}/tasks/active`)
            const data: Task[] = await res.json()
            setTasks(data)
        } catch (e) {
            console.error(e)
        }
    }

    // Kick off a new task
    async function startTask(type: Task['task_type']) {
        const res = await fetch(`${API}/tasks/${type}`, { method: 'POST' })
        if (res.ok) fetchTasks()
    }

    // Optionally, cancel a running task (you can add a cancel endpoint)
    async function cancelTask(id: string) {
        await fetch(`${API}/tasks/${id}/cancel`, { method: 'POST' })
        fetchTasks()
    }

    // Poll every 3s
    useEffect(() => {
        fetchTasks()
        const iv = setInterval(fetchTasks, 3000)
        return () => clearInterval(iv)
    }, [])

    return (
        <div className="p-4 bg-gray-900 rounded-lg shadow-lg space-y-4">
            <h3 className="text-lg font-semibold">Processing Tasks</h3>

            {tasks.map(t => (
                <div key={t.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span>{t.task_type.replace('_', ' ')}</span>
                        <span>{t.status}</span>
                    </div>
                    <div className="w-full bg-gray-700 h-2 rounded overflow-hidden">
                        <div
                            className="h-full bg-accent transition-width"
                            style={{ width: t.total ? `${(t.processed / t.total) * 100}%` : '0%' }}
                        />
                    </div>
                    {t.status === 'running' && (
                        <button
                            onClick={() => cancelTask(t.id)}
                            className="text-xs hover:underline"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            ))}

            <div className="pt-4 flex space-x-2">
                <button
                    onClick={() => startTask('scan')}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2"
                >
                    Scan Media
                </button>
                <button
                    onClick={() => startTask('extract_faces')}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2"
                >
                    Extract Faces
                </button>
                <button
                    onClick={() => startTask('create_embeddings')}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2"
                >
                    Create Embeddings
                </button>
            </div>
        </div>
    )
}
