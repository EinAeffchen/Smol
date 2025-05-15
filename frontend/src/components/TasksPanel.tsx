// src/components/TasksPanel.tsx
import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, LinearProgress, Paper, Stack } from '@mui/material'
import { Task, TaskType } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

// human-readable labels for task types
type TaskLabels = Record<TaskType, string>
const TASK_LABELS: TaskLabels = {
    scan: 'Scan Folder',
    process_media: 'Process Media',
    cluster_persons: 'Cluster Persons',
}

export default function TasksPanel() {
    const [tasks, setTasks] = useState<Task[]>([])

    // fetch active tasks\  
    const fetchTasks = async () => {
        try {
            const res = await fetch(`${API}/tasks/active`)
            const data: Task[] = await res.json()
            setTasks(data)
        } catch (err) {
            console.error('Could not load tasks:', err)
        }
    }

    // start a new task
    const startTask = async (type: TaskType) => {
        try {
            const res = await fetch(`${API}/tasks/${type}`, { method: 'POST' })
            if (res.ok) {
                await fetchTasks()
            } else {
                console.error('Failed to start task', type)
            }
        } catch (err) {
            console.error('Error starting task', type, err)
        }
    }

    // cancel a running task
    const cancelTask = async (id: string) => {
        try {
            const res = await fetch(`${API}/tasks/${id}/cancel`, { method: 'POST' })
            if (res.ok) {
                fetchTasks()
            } else {
                console.error('Failed to cancel task', id)
            }
        } catch (err) {
            console.error('Error cancelling task', id, err)
        }
    }

    // polling
    useEffect(() => {
        fetchTasks()
        const iv = setInterval(fetchTasks, 3000)
        return () => clearInterval(iv)
    }, [])

    return (
        <Paper
            elevation={4}
            sx={{
                p: 3,
                bgcolor: '#1C1C1E',
                color: '#FFF',
                borderRadius: 2,
                boxShadow: 3,
            }}
        >
            <Typography variant="h6" gutterBottom sx={{ color: '#FF2E88' }}>
                Control Panel
            </Typography>

            <Stack spacing={2}>
                {tasks.map(t => {
                    const pct = t.total > 0 ? Math.round((t.processed / t.total) * 100) : 0
                    return (
                        <Box
                            key={t.id}
                            sx={{
                                p: 2,
                                bgcolor: '#2C2C2E',
                                borderLeft: '4px solid #5F4B8B',
                                borderRadius: 1,
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" sx={{ color: '#FF2E88' }}>
                                    {TASK_LABELS[t.task_type]}
                                </Typography>
                                <Typography variant="caption">
                                    {t.status}{t.status === 'running' && ` (${pct}%)`}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{
                                    height: 8,
                                    borderRadius: 1,
                                    mt: 1,
                                    backgroundColor: '#3A3A3C',
                                    '& .MuiLinearProgress-bar': { bgcolor: '#FF2E88' },
                                }}
                            />
                            {t.status === 'running' && (
                                <Button
                                    size="small"
                                    onClick={() => cancelTask(t.id)}
                                    sx={{ mt: 1, color: '#FF2E88' }}
                                >
                                    Cancel
                                </Button>
                            )}
                        </Box>
                    )
                })}
            </Stack>

            <Stack spacing={1} mt={3}>
                <Button
                    variant="contained"
                    onClick={() => startTask('scan')}
                    sx={{
                        bgcolor: '#5F4B8B',
                        '&:hover': { bgcolor: '#4A3A6A' },
                    }}
                >
                    Scan Folder
                </Button>
                <Button
                    variant="contained"
                    onClick={() => startTask('process_media')}
                    sx={{
                        bgcolor: '#5F4B8B',
                        '&:hover': { bgcolor: '#4A3A6A' },
                    }}
                >
                    Process Media
                </Button>
                <Button
                    variant="contained"
                    onClick={() => startTask('cluster_persons')}
                    sx={{
                        bgcolor: '#5F4B8B',
                        '&:hover': { bgcolor: '#4A3A6A' },
                    }}
                >
                    Cluster Persons
                </Button>
            </Stack>
        </Paper>
    )
}
