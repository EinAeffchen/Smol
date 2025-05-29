import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    Dialog,
    DialogTitle,
    DialogActions,
    Snackbar,
    LinearProgress,
    Alert,
} from '@mui/material'
import { VideoWithPreview } from '../components/VideoPlayer'
import PersonCard from '../components/PersonCard'
import TagAdder from '../components/TagAdder'
import { Tags } from '../components/Tags'

import DetectedFaces from '../components/DetectedFaces'
import SimilarContent from '../components/MediaRelatedContent'
import { useFaceActions } from '../hooks/useFaceActions'
import { MediaDetail, Task } from '../types'
import { MediaExif } from '../components/MediaExif'

const ACCENT = '#5F4B8B'
const ERROR = 'error'
const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function MediaDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<MediaDetail | null>(null)
    const [task, setTask] = useState<Task | null>(null)
    const [dialogType, setDialogType] = useState<'convert' | 'deleteRecord' | 'deleteFile' | null>(null)
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
    const [showExif, setShowExif] = useState(false)
    const { assignFace, createPersonFromFace, deleteFace, setProfileFace } = useFaceActions()

    // Load media detail
    const loadDetail = useCallback(async () => {
        if (!id) return
        try {
            const res = await fetch(`${API}/media/${id}`)
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
        if (!task || task.status === "finished") return

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/tasks/${task.id}`)
                if (!res.ok) throw new Error()
                const updated = await res.json()
                setTask(updated)
                if (updated.status === "finished") {
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
    const openDialog = (type: 'convert' | 'deleteRecord' | 'deleteFile') => setDialogType(type)
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
            const res = await fetch(`${API}/media/${media.id}`, { method: 'DELETE' })
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
            const res = await fetch(`${API}/media/${media.id}/file`, { method: 'DELETE' })
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

    const onCreateFace = async (faceId: number, data: any) => {
        const p = await createPersonFromFace(faceId, data)
        setDetail({
            ...detail,
            orphans: orphans.filter(f => f.id !== faceId),
        })
        navigate(`/person/${p.id}`)
        return p
    }

    return (
        <Container maxWidth="lg" sx={{ pt: 4, pb: 6, bgcolor: '#1C1C1E', color: '#FFF' }}>
            {/* Header & Actions */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h4" sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    maxWidth: '10rem',
                    wordBreak: 'break-word',
                    fontSize: 'clamp(0.7rem, 2.5vw, 1.5rem)',  // shrink/expand between 1rem–1.5rem
                    textAlign: 'left',
                }}>{media.filename}</Typography>
                <Box>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: ACCENT, borderColor: ACCENT, mr: 1 }}
                        onClick={() => setShowExif(v => !v)}
                    >
                        {showExif ? 'Hide EXIF' : 'Show EXIF'}
                    </Button>
                    <Button variant="contained" sx={{ bgcolor: ACCENT, mr: 1 }} onClick={() => openDialog('convert')}>Convert</Button>
                    <Button variant="contained" color={ERROR} sx={{ mr: 1 }} onClick={() => openDialog('deleteRecord')}>Delete Record</Button>
                    <Button variant="contained" color={ERROR} onClick={() => openDialog('deleteFile')}>Delete File</Button>
                </Box>
            </Box>

            {/* Dialogs */}
            <Dialog open={dialogType === 'convert'} onClose={closeDialog}>
                <DialogTitle>Convert Video Format?</DialogTitle>
                <DialogActions>
                    <Button onClick={closeDialog} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" onClick={confirmConvert}>Confirm</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={dialogType === 'deleteRecord'} onClose={closeDialog}>
                <DialogTitle>Delete Database Record?</DialogTitle>
                <DialogActions>
                    <Button onClick={closeDialog} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" color={ERROR} onClick={confirmDeleteRecord}>Delete</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={dialogType === 'deleteFile'} onClose={closeDialog}>
                <DialogTitle>Delete File from Disk?</DialogTitle>
                <DialogActions>
                    <Button onClick={closeDialog} sx={{ color: "white" }}>Cancel</Button>
                    <Button variant="contained" color={ERROR} onClick={confirmDeleteFile}>Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} sx={{ width: '100%' }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
            {task && task.status === "running" && (
                <Box mb={2}>
                    <Typography variant="body2" gutterBottom>
                        Converting… {task.processed}%
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={task.processed}
                        sx={{ height: 8, borderRadius: 1, bgcolor: 'grey.800' }}
                    />
                </Box>
            )}

            {/* Centered Media */}
            <Box display="flex" justifyContent="center" mb={4}>
                <Paper elevation={4} sx={{ width: '100%', maxWidth: 800, maxHeight: 500, overflow: 'hidden', borderRadius: 2, bgcolor: 'background.paper' }}>
                    {media.duration ? (
                        <VideoWithPreview key={media.id} media={media} />
                    ) : (
                        <Box component="img" src={`${API}/originals/${media.path}`} alt={media.filename} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                </Paper>
            </Box>
            <MediaExif show={showExif} mediaId={media.id} />

            {/* Detected Persons */}
            <Box mb={4}>
                <Typography variant="h6" gutterBottom>Detected Persons</Typography>
                <Box sx={{ display: 'flex', overflowX: 'auto', gap: 2, py: 1 }}>
                    {persons.map(p => (
                        <PersonCard key={p.id} person={p} />
                    ))}
                </Box>
            </Box>

            {/* Unassigned Faces */}
            {(orphans.length > 0 &&
                <Box mb={4}>
                    <DetectedFaces
                        title="Unassigned Faces"
                        faces={orphans}
                        onAssign={onAssign}
                        onSetProfile={() => { alert('No profile to set') }}
                        onCreate={(faceId: number, data: any) => onCreateFace(faceId, data)}
                        onDelete={onDeleteFace}
                    />
                </Box>
            )}

            <Box mb={4}>
                <Typography variant="h6" gutterBottom>Add tag to media</Typography>
                <TagAdder ownerType="media" ownerId={media.id} existingTags={media.tags ?? []} onTagAdded={handleTagAdded} />
            </Box>
            {/* Tags */}
            {(media.tags.length > 0 &&
                <Tags media={media} onUpdate={handleTagUpdateFromChild} />
            )
            }
            {/* Similar Content */}
            <Box>
                <Grid container spacing={2}>
                    <SimilarContent mediaId={media.id} />
                </Grid>
            </Box>
        </Container >
    )
}
