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
import { PeopleSection } from '../components/PeopleSection'
import { MediaHeader } from '../components/MediaHeader'
import SimilarContent from '../components/MediaRelatedContent'
import { useFaceActions } from '../hooks/useFaceActions'
import { MediaDetail, Task } from '../types'
import { TagsSection } from '../components/TagsSection'
import { MediaExif } from '../components/MediaExif'
import { ENABLE_PEOPLE } from '../config'
import { API } from '../config'

export default function MediaDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<MediaDetail | null>(null)
    const [task, setTask] = useState<Task | null>(null)
    const [dialogType, setDialogType] = useState<'convert' | 'deleteRecord' | 'deleteFile' | null>(null)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
    const [showExif, setShowExif] = useState(false)
    const faceActions = useFaceActions();

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
        loadDetail()
    }, [id])
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

    if (!detail) return <Typography p={2}>Loading…</Typography>

    const { media, persons, orphans } = detail

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

    const handleTagUpdateFromChild = (updatedMediaObject: Media) => {
        setDetail(prevDetailState => {
            if (!prevDetailState) {
                // This should ideally not happen if UI elements using this are only rendered when detail exists
                console.error("Cannot update media: previous detail state is null.");
                return null;
            }
            return {
                ...prevDetailState, // Preserve other parts of MediaDetail (persons, orphans, etc.)
                media: updatedMediaObject, // Update only the media property
            };
        });
    };

    // Face assignment handlers
    const onAssign = async (faceId: number, personId: number) => {
        await assignFace(faceId, personId)
        loadDetail()
    }

    const onDeleteFace = async (faceId: number) => {
        await deleteFace(faceId)
        setDetail({
            ...detail,
            orphans: orphans.filter(f => f.id !== faceId),
        })
    }

    const onDetachFace = async (faceId: number) => {
        await detachFace(faceId)
        setDetail({
            ...detail,
            orphans: orphans.filter(f => f.id !== faceId),
        })
    }

    const onCreateFace = async (faceId: number, data: any) => {
        const p = await createPersonFromFace(faceId, data)
        setDetail({
            ...detail,
            orphans: orphans.filter(f => f.id !== faceId),
        })
        navigate(`/person/${p.id}`)
        return p
    }

    const SectionLoader = ({ height = '200px' }: { height?: string }) => (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Container maxWidth="lg" sx={{ pt: 2, pb: 6, bgcolor: '#1C1C1E', color: '#FFF' }}>
            <MediaHeader
                media={media}
                showExif={showExif}
                onToggleExif={() => setShowExif(v => !v)}
                onOpenDialog={setDialogType}
            />
            <ActionDialogs
                dialogType={dialogType}
                onClose={() => setDialogType(null)}
                onConfirmConvert={confirmConvert}
                onConfirmDeleteRecord={confirmDeleteRecord}
                onConfirmDeleteFile={confirmDeleteFile}
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

            <MediaDisplay media={media} />
            <MediaExif show={showExif} mediaId={media.id} />

            {ENABLE_PEOPLE && (
                <PeopleSection
                    persons={persons}
                    orphans={orphans}
                    onAssign={onAssign}
                    onCreateFace={onCreateFace}
                    onDeleteFace={onDeleteFace}
                    onDetachFace={onDetachFace}
                />
            )}
            <TagsSection
                media={media}
                onTagAdded={handleTagAdded}
                onUpdate={handleTagUpdateFromChild}
            />
            <Box mt={4}>
                <SimilarContent mediaId={media.id} />
            </Box>
        </Container >
    )
}
