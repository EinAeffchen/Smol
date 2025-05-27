import React, { useState, useEffect, useCallback, FormEvent } from 'react'
import Snackbar from '@mui/material/Snackbar'
import CancelIcon from '@mui/icons-material/Cancel'
import Alert from '@mui/material/Alert'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
    Avatar,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
    Paper
} from '@mui/material'
import MediaCard from '../components/MediaCard'
import SimilarPersonCard from '../components/SimilarPersonCard'
import TagAdder from '../components/TagAdder'
import DetectedFaces from '../components/DetectedFaces'
import { useFaceActions } from '../hooks/useFaceActions'
import { FaceRead, Person, PersonDetail, SimilarPerson, Tag } from '../types'
import { MediaAppearances } from '../components/MediaAppearances'
import { PersonEditForm } from '../components/PersonEditForm'
const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function PersonDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<PersonDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '', age: '', gender: '' })
    const [saving, setSaving] = useState(false)

    const [mergeOpen, setMergeOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [candidates, setCandidates] = useState<Person[]>([])

    const [similar, setSimilar] = useState<SimilarPerson[]>([])
    const [richSimilar, setRichSimilar] = useState<SimilarPerson[]>([])
    const [loadingSim, setLoadingSim] = useState(false)

    const [suggestedFaces, setSuggestedFaces] = useState<FaceRead[]>([])

    const { assignFace, createPersonFromFace, deleteFace, setProfileFace } = useFaceActions()

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
    const [confirmDelete, setConfirmDelete] = useState(false)

    const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
        setSnackbar({ open: true, message, severity })
    }
    const loadDetail = useCallback(async () => {
        console.log(id)
        if (!id) return
        try {
            const res = await fetch(`${API}/persons/${id}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setDetail(data)
            setForm({
                name: data.person.name ?? '',
                age: data.person.age ?? '',
                gender: data.person.gender ?? '',
            })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [id])

    const loadSuggestedFaces = useCallback(async () => {
        if (!id) return
        try {
            const res = await fetch(`${API}/persons/${id}/suggest-faces`)
            if (!res.ok) return
            setSuggestedFaces(await res.json())
        } catch (err) {
            console.error(err)
        }
    }, [id])

    async function loadSimilar() {
        if (!id) return
        setSimilar([]);
        setLoadingSim(true)
        const res = await fetch(`${API}/persons/${id}/similarities`)
        if (!res.ok) return
        const data = await res.json()
        setSimilar(data)
        setLoadingSim(false)
    }

    useEffect(() => {
        loadDetail()
        loadSuggestedFaces()
        loadSimilar()
    }, [id])

    useEffect(() => {
        if (similar.length === 0) {
            setRichSimilar([])
            return
        }
        Promise.all(similar.map(async p => {
            const res = await fetch(`${API}/persons/${p.id}`)
            if (!res.ok) return p
            const detail = await res.json()
            return {
                ...p,
                name: detail.person.name,
                thumbnail: detail.person.profile_face?.thumbnail_path,
            }
        })).then(setRichSimilar)
    }, [similar])

    async function deletePerson() {
        if (!id) return
        const res = await fetch(`${API}/persons/${person.id}`, { method: 'DELETE' })
        if (res.ok) {
            showMessage('Person deleted', 'success')
            navigate('/', { replace: true })
        } else {
            showMessage('Failed to delete person', 'error')
        }
        setConfirmDelete(false)
    }

    async function onSave(e: FormEvent) {
        e.preventDefault()
        if (!id) return
        setSaving(true)
        try {
            const payload: any = {
                name: form.name,
                gender: form.gender,
            }
            if (form.age !== '') payload.age = Number(form.age)

            const res = await fetch(`${API}/persons/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error(await res.text())
            await loadDetail()
            showMessage('Saved successfully', 'success')
        } catch (err) {
            console.error(err)
            showMessage('Save failed', 'error')
        } finally {
            setSaving(false)
        }
    }


    const handleCreate = async (faceId: number, data: any): Promise<Person> => {
        const p = await createPersonFromFace(faceId, data)
        await loadDetail()
        await loadSuggestedFaces()
        navigate(`/person/${p.id}`)
        return p
    }

    const handleAssign = async (faceId: number, personId: number) => {
        await assignFace(faceId, personId)
        await loadDetail()
        await loadSuggestedFaces()
        // await loadSimilar()
    }
    const handleProfileAssignment = async (faceId: number, personId: number) => {
        await setProfileFace(faceId, personId)
        await loadDetail()
    }

    const handleDelete = async (faceId: number) => {
        await deleteFace(faceId)
        await loadDetail()
    }

    async function doMerge(targetId: number) {
        if (!id || Number(id) === targetId) return
        setMergeOpen(false)
        await fetch(`${API}/persons/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: Number(id), target_id: targetId })
        })
        navigate(`/person/${targetId}`, { replace: true })
    }

    useEffect(() => {
        if (!mergeOpen || !searchTerm.trim()) return setCandidates([])
        fetch(`${API}/persons/?name=${encodeURIComponent(searchTerm)}`)
            .then(r => r.json())
            .then(r => setCandidates(r.items))
    }, [mergeOpen, searchTerm])

    if (loading || !detail) return <Typography p={2}>Loading…</Typography>
    const { person, faces, medias } = detail

    return (
        <Container maxWidth="lg" sx={{ pt: 2, pb: 6 }}>
            {/* Title and controls */}
            <Grid container alignItems="center" spacing={2} justifyContent="space-between" mb={2}>
                <Grid size={{ xs: 12, md: "auto" }} >
                    <Typography variant="h4">{person.name || 'Unnamed'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: "auto" }}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button variant="contained" color="secondary" onClick={() => setMergeOpen(true)}>Merge</Button>
                        <Button variant="contained" color="secondary" onClick={() => loadSimilar()}>Refresh Similar Persons</Button>
                        <Button variant="contained" color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>
                    </Stack>
                </Grid>
            </Grid>

            {/* Profile  Form as horizontal layout */}
            <Paper sx={{ display: 'flex', p: 3, gap: 4, alignItems: 'center', bgcolor: '#2C2C2E', mb: 4 }}>
                <Avatar
                    src={`${API}/thumbnails/${person.profile_face?.thumbnail_path}`}
                    sx={{ width: 100, height: 100, border: '4px solid #FF2E88' }}
                />
                {person && <PersonEditForm initialPersonData={form} onSave={onSave} saving={saving} />}
            </Paper>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} sx={{ width: '100%' }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Confirm Delete Dialog */}
            <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this person?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button onClick={deletePerson} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>

            {/* Tags */}
            <Box mt={4} sx={{ bgcolor: '#2C2C2E', p: 2, borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Tags</Typography>
                    <TagAdder ownerType="persons" ownerId={person.id} existingTags={person.tags ?? []} onTagAdded={() => loadDetail()} />
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(person.tags ?? []).map((tag: Tag) => (
                        <Chip
                            key={tag.id}
                            label={tag.name}
                            component={Link}
                            to={`/tag/${tag.id}`}
                            clickable
                            onDelete={(e) => {
                                // prevent navigation when clicking the X
                                e.stopPropagation()
                                e.preventDefault()
                                // then do your delete
                                fetch(`${API}/tags/persons/${person.id}/${tag.id}`, { method: 'DELETE' })
                                    .then(() => loadDetail())
                            }}
                            deleteIcon={
                                <CancelIcon
                                    onMouseDown={e => e.stopPropagation()}
                                />
                            }
                            color="secondary"
                            sx={{ bgcolor: '#FF2E88', color: '#FFF' }}
                        />
                    ))}
                </Stack>
            </Box>

            {/* Media */}
            <MediaAppearances medias={medias}></MediaAppearances>
            {/* Detected Faces */}
            <Box mt={4}>
                <DetectedFaces
                    faces={faces}
                    title="Detected Faces"
                    horizontal
                    profileFaceId={person.profile_face_id}
                    onAssign={handleAssign}
                    onCreate={handleCreate}
                    onDelete={handleDelete}
                    onSetProfile={(faceId) => handleProfileAssignment(faceId, person.id)}
                />
            </Box>

            {/* Suggested Faces */}
            {suggestedFaces.length > 0 && (
                <Box mt={4}>
                    <DetectedFaces
                        faces={suggestedFaces}
                        title="Is this the same person?"
                        horizontal
                        onAssign={handleAssign}
                        onCreate={handleCreate}
                        onDelete={handleDelete}
                        onSetProfile={() => { }}
                    />
                </Box>
            )}

            {/* Similar People */}
            {richSimilar?.length > 0 && (
                <Box mt={4}>
                    <Typography variant="h6" gutterBottom>Similar People</Typography>
                    <Grid container spacing={2}>
                        {richSimilar.map(p => (
                            <Grid key={p.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                <SimilarPersonCard {...p} />
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {/* Merge Dialog */}
            <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)}>
                <DialogTitle>Merge "{person.name}" into…</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Search by name…"
                        fullWidth
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Stack spacing={1}>
                        {candidates.map(c => (
                            <Box
                                key={c.id}
                                onClick={() => doMerge(c.id)}
                                sx={{ p: 1, bgcolor: '#2C2C2E', borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: '#3C3C3E' } }}
                            >
                                <Typography>{c.name ?? 'Unknown'}</Typography>
                            </Box>
                        ))}
                        {searchTerm && candidates.length === 0 && (
                            <Typography color="text.secondary">No matches</Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMergeOpen(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
