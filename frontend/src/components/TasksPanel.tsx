// frontend/src/components/TasksPanel.tsx
import React, { useState, useEffect } from 'react'

type TaskType = 'process_media' | 'cluster_persons'
type TaskStatus = 'pending' | 'running' | 'completed' | 'cancelled'

interface Task {
    id: string
    task_type: TaskType
    status: TaskStatus
    total: number
    processed: number
}

const API = import.meta.env.VITE_API_BASE_URL || ''

// map API task_type to a human‐readable label
const TASK_LABELS: Record<TaskType, string> = {
    process_media: 'Process Media',
    cluster_persons: 'Cluster Persons',
}

export default function TasksPanel() {
    const [tasks, setTasks] = useState<Task[]>([])

    // fetch all existing tasks
    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API}/tasks/active/`)
            const data: Task[] = await res.json()
            setTasks(data)
        } catch (err) {
            console.error('Could not load tasks:', err)
        }
    }

    // kick off a new task
    const startTask = async (type: TaskType) => {
        try {
            const res = await fetch(`${API}/tasks/${type}`, { method: 'POST' })
            if (res.ok) {
                await fetchTasks()
            } else {
                console.error('Failed to start task', type, await res.text())
            }
        } catch (err) {
            console.error('Error starting task', type, err)
        }
    }

    // cancel a running task
    const cancelTask = async (id: string) => {
        try {
            const res = await fetch(`${API}/tasks/${id}/cancel`, { method: 'POST' })
            if (res.ok) fetchTasks()
            else console.error('Failed to cancel task', id, await res.text())
        } catch (err) {
            console.error('Error cancelling task', id, err)
        }
    }

    useEffect(() => {
        fetchTasks()
        const iv = setInterval(fetchTasks, 3000)
        return () => clearInterval(iv)
    }, [])

    return (
        <div className="p-4 bg-gray-900 rounded-lg shadow-lg space-y-4">
            <h3 className="text-lg font-semibold">Control Panel</h3>

            {tasks.map(t => {
                const pct = t.total > 0 ? Math.round((t.processed / t.total) * 100) : 0
                return (
                    <div key={t.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>{TASK_LABELS[t.task_type]}</span>
                            <span>{t.status}{t.status === 'running' ? ` (${pct}%)` : ''}</span>
                        </div>
                        <div className="w-full bg-gray-700 h-2 rounded overflow-hidden">
                            <div
                                className="h-full bg-accent transition-width"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        {t.status === 'running' && (
                            <button
                                onClick={() => cancelTask(t.id)}
                                className="text-xs text-red-400 hover:underline"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )
            })}

            <div className="pt-4 flex space-x-2">
                <button
                    onClick={() => startTask('process_media')}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2 text-background"
                >
                    Process Media
                </button>
                <button
                    onClick={() => startTask('cluster_persons')}
                    className="px-3 py-1 bg-accent rounded hover:bg-accent2 text-background"
                >
                    Cluster Persons
                </button>
            </div>
        </div>
    )
}
