import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Container,
    Box,
    Typography,
    CircularProgress,
    Snackbar,
    LinearProgress,
    Alert,
} from '@mui/material'
import { ActionDialogs } from '../components/ActionDialogs'
import { MediaDisplay } from '../components/MediaDisplay'
import { MediaHeader } from '../components/MediaHeader'
import { useFaceActions } from '../hooks/useFaceActions'
import { MediaDetail, Task } from '../types'
import { API } from '../config'
import { MediaContentTabs } from '../components/MediaContentTabs'

export default function MediaDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<MediaDetail | null>(null)
    const [task, setTask] = useState<Task | null>(null)
    const [dialogType, setDialogType] = useState<'convert' | 'deleteRecord' | 'deleteFile' | null>(null)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
    const [tabValue, setTabValue] = useState(0);

    // Load media detail
    const loadDetail = useCallback(async () => {
        if (!id) return
        try {
            const res = await fetch(`${API}/api/media/${id}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setDetail(data);
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to load media', severity: 'error' })
        }
    }, [id])
    useEffect(() => {
        setDetail(null)
        setTabValue(0);
        loadDetail()
    }, [id, loadDetail])

    useEffect(() => {
        if (!task || task.status === "completed") return

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/tasks/${task.id}`)
                if (!res.ok) throw new Error()
                const updated = await res.json()
                setTask(updated)
                if (updated.status === "completed") {
                    clearInterval(interval)
                    loadDetail()  // refresh media to reflect new file
                }
            } catch {
                console.warn("Failed to update task progress")
            }
        }, 1500)

        return () => clearInterval(interval)
    }, [task])

    if (!detail) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const { media } = detail


    // Dialog controls
    const closeDialog = () => setDialogType(null)

    // Confirm actions
    const confirmConvert = async () => {
        if (!media) return
        try {
            const res = await fetch(`${API}/api/media/${media.id}/converter`, { method: 'POST' })
            if (!res.ok) throw new Error()
            const t: Task = await res.json()
            setTask(t)
            setSnackbar({ open: true, message: 'Conversion started', severity: 'success' })
        } catch {
            setSnackbar({ open: true, message: 'Conversion failed', severity: 'error' })
        } finally {
            closeDialog()
        }
    }

    const confirmDeleteRecord = async () => {
        if (!media) return
        try {
            const res = await fetch(`${API}/api/media/${media.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setSnackbar({ open: true, message: 'Record deleted', severity: 'success' })
            navigate('/')
        } catch {
            setSnackbar({ open: true, message: 'Delete failed', severity: 'error' })
        } finally {
            closeDialog()
        }
    }

    const confirmDeleteFile = async () => {
        if (!media) return
        try {
            const res = await fetch(`${API}/api/media/${media.id}/file`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setSnackbar({ open: true, message: 'File deleted', severity: 'success' })
            navigate('/')
        } catch {
            setSnackbar({ open: true, message: 'File delete failed', severity: 'error' })
        } finally {
            closeDialog()
        }
    }

    // Tag added handler
    const handleTagAdded = (tag: any) => {
        setDetail({
            ...detail,
            media: {
                ...media,
                tags: [...(media.tags ?? []), tag],
            },
        })
    }

    const handleToggleExif = () => {
        setTabValue(3);
    };
    return (
        <Container maxWidth="xl" sx={{ pt: 2, pb: 6 }}>
            <MediaHeader
                media={media}
                showExif={tabValue === 3} // The button text can reflect if the Details tab is active
                onToggleExif={handleToggleExif} // CHANGED: This now controls the tabs
                onOpenDialog={setDialogType}
            />
            <MediaDisplay media={media} />
            <ActionDialogs
                dialogType={dialogType}
                onClose={() => setDialogType(null)}
                onConfirmConvert={confirmConvert}
                onConfirmDeleteRecord={confirmDeleteRecord}
                onConfirmDeleteFile={confirmDeleteFile}
            />
            {/* --- Tabbed Content Area --- */}
            <MediaContentTabs
                detail={detail}
                onDetailReload={loadDetail}
                onTagUpdate={(updatedMedia) => setDetail(d => d ? { ...d, media: updatedMedia } : null)}
            />
            {/* Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} sx={{ width: '100%' }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {task && task.status === "running" && (
                <Box mb={2}>
                    <Typography variant="body2" gutterBottom>Converting… {task.processed}%</Typography>
                    <LinearProgress variant="determinate" value={task.processed} sx={{ height: 8, borderRadius: 1 }} />
                </Box>
            )}
        </Container >
    )
}
