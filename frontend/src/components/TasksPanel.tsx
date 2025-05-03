// frontend/src/components/TasksPanel.tsx
import React, { useState, useEffect } from 'react'
import { Task, TaskType } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

// map API task_type to a human-readable label
const TASK_LABELS: Record<TaskType, string> = {
    scan_folder: 'Scan Folder',
    process_media: 'Process Media',
    cluster_persons: 'Cluster Persons',
}

export default function TasksPanel() {
    const [tasks, setTasks] = useState<Task[]>([])

    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API}/tasks/active`)
            const data: Task[] = await res.json()
            setTasks(data)
        } catch (err) {
            console.error('Could not load tasks:', err)
        }
    }

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
        <div className="p-4 bg-background/80 backdrop-blur-md rounded-xl border border-accent shadow-lg space-y-4">
            <h3 className="text-xl font-semibold text-accent">Control Panel</h3>

            {tasks.map(t => {
                const pct = t.total > 0 ? Math.round((t.processed / t.total) * 100) : 0
                return (
                    <div key={t.id} className="p-2 bg-background/70 rounded-lg border-l-4 border-accent space-y-1">
                        <div className="flex justify-between items-center text-sm text-text">
                            <span className="font-medium text-accent">{TASK_LABELS[t.task_type]}</span>
                            <span className="text-xs">{t.status}{t.status === 'running' && ` (${pct}%)`}</span>
                        </div>
                        <div className="w-full bg-dark-gray h-1.5 rounded overflow-hidden">
                            <div
                                className="h-full bg-accent transition-[width]"
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

            <div className="pt-2 flex flex-col space-y-2">
                <button
                    onClick={() => startTask('scan')}
                    className="w-full px-3 py-2 bg-accent rounded-md hover:bg-accent2 text-text transition">
                    Scan Folder
                </button>
                <button
                    onClick={() => startTask('process_media')}
                    className="w-full px-3 py-2 bg-accent rounded-md hover:bg-accent2 text-text transition">
                    Process Media
                </button>
                <button
                    onClick={() => startTask('cluster_persons')}
                    className="w-full px-3 py-2 bg-accent rounded-md hover:bg-accent2 text-text transition">
                    Cluster Persons
                </button>
            </div>
        </div>
    )
}
