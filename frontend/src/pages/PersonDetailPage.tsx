import CancelIcon from '@mui/icons-material/Cancel'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TagAdder from '../components/TagAdder'
import { API, READ_ONLY } from '../config'
import { useFaceActions } from '../hooks/useFaceActions'
import { CursorResponse } from '../hooks/useInfinite'
import { FaceRead, Person, PersonDetail, SimilarPerson, SimilarPersonWithDetails, Tag } from '../types'
import { PersonHero } from '../components/PersonHero'
import { PersonContentTabs } from '../components/PersonContentTabs'

export default function PersonDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<PersonDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '', age: '', gender: '' })
    const [saving, setSaving] = useState(false)

    // States for the paginated "Detected Faces" section
    const [detectedFacesList, setDetectedFacesList] = useState<FaceRead[]>([]);
    const [facesNextCursor, setFacesNextCursor] = useState<string | null>(null);
    const [loadingMoreFaces, setLoadingMoreFaces] = useState<boolean>(false);
    const [hasMoreFaces, setHasMoreFaces] = useState<boolean>(true); // Assume more initially


    const [mergeOpen, setMergeOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [candidates, setCandidates] = useState<Person[]>([])
    const [similarPersons, setSimilarPersons] = useState<SimilarPerson[]>([])
    const [suggestedFaces, setSuggestedFaces] = useState<FaceRead[]>([])

    const { assignFace, createPersonFromFace, deleteFace, detachFace, setProfileFace } = useFaceActions()
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
    const [confirmDelete, setConfirmDelete] = useState(false)

    const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
        setSnackbar({ open: true, message, severity })
    }

    const loadDetail = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`${API}/api/persons/${id}`);
            if (!res.ok) throw new Error('Failed to fetch person details');
            const personData: PersonDetail = await res.json(); // Assuming this no longer sends bulk faces
            setDetail(personData);
            setForm({
                name: personData.person.name ?? '',
                age: personData.person.age?.toString() ?? '', // Ensure age is string for form
                gender: personData.person.gender ?? '',
            });
        } catch (err) {
            console.error("Error in loadDetail:", err);
            setDetail(null);
        }
    }, [id, API]);

    const fetchFacesPage = useCallback(async (personId: string, cursor: string | null, limit: number = 20): Promise<CursorResponse<FaceRead> | null> => {
        let url = `${API}/api/persons/${personId}/faces?limit=${limit}`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch faces for person ${personId}: ${res.status}`);
                return null;
            }
            return await res.json();
        } catch (error) {
            console.error(`Error fetching faces for person ${personId}:`, error);
            return null;
        }
    }, [API]);


    const loadInitialDetectedFaces = useCallback(async (personId: string) => {
        if (!personId) return;
        setLoadingMoreFaces(true); // Use this for initial load as well
        setDetectedFacesList([]);
        setFacesNextCursor(null);
        setHasMoreFaces(true); // Reset assumption

        const pageData = await fetchFacesPage(personId, null);
        if (pageData) {
            setDetectedFacesList(pageData.items);
            setFacesNextCursor(pageData.next_cursor);
            setHasMoreFaces(!!pageData.next_cursor && pageData.items.length > 0);
        } else {
            setHasMoreFaces(false);
        }
        setLoadingMoreFaces(false);
    }, [fetchFacesPage]);

    const loadMoreDetectedFaces = useCallback(async () => {
        if (!id || !facesNextCursor || loadingMoreFaces || !hasMoreFaces) return;
        setLoadingMoreFaces(true);
        const pageData = await fetchFacesPage(id, facesNextCursor);
        if (pageData?.items) {
            setDetectedFacesList(prevFaces => [...prevFaces, ...pageData.items]);
            setFacesNextCursor(pageData.next_cursor);
            setHasMoreFaces(!!pageData.next_cursor && pageData.items.length > 0);
        } else {
            setHasMoreFaces(false); // No more items or error
        }
        setLoadingMoreFaces(false);
    }, [id, facesNextCursor, loadingMoreFaces, hasMoreFaces, fetchFacesPage]);


    const loadSuggestedFaces = useCallback(async () => {
        if (!id) return
        try {
            const res = await fetch(`${API}/api/persons/${id}/suggest-faces`)
            if (!res.ok) return
            setSuggestedFaces(await res.json())
        } catch (err) {
            console.error(err)
        }
    }, [id])

    const loadSimilar = useCallback(async () => {
        if (!id) return;
        setSimilarPersons([]);
        try {
            const res = await fetch(`${API}/api/persons/${id}/similarities`);
            if (!res.ok) {
                console.error('Failed to fetch similarities:', res.status);
                return;
            }
            const data: SimilarPersonWithDetails[] = await res.json();
            setSimilarPersons(data);
        } catch (error) {
            console.error('Error loading similarities:', error);
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            // setLoading(true);
            // setDetail(null);
            // setDetectedFacesList([]);
            // setFacesNextCursor(null);
            // setHasMoreFaces(true);
            // setLoadingMoreFaces(false);
            // setSuggestedFaces([]);
            // setSimilarPersons([]);

            const initialLoad = async () => {
                await Promise.all([
                    loadDetail(),
                    loadInitialDetectedFaces(id),
                ]);
                setLoading(false);
            };
            initialLoad();
        } else {
            setLoading(false);
            setDetail(null);
        }
    }, [id, loadDetail, loadInitialDetectedFaces]);

    const handleAssignWrapper = async (faceId: number, assignedToPersonId: number) => {
        await assignFace(faceId, assignedToPersonId);
        if (detail && assignedToPersonId !== detail.person.id) {
            setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        } else if (detail && assignedToPersonId === detail.person.id) {
            if (id) loadInitialDetectedFaces(id);
        }
        loadDetail();
        loadSuggestedFaces();
    };

    const handleDeleteWrapper = async (faceId: number) => {
        await deleteFace(faceId);
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        loadDetail();
    };

    const handleDetachWrapper = async (faceId: number) => {
        await detachFace(faceId);
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        loadDetail();
    };

    const handleCreateWrapper = async (faceId: number, data: any): Promise<Person> => {
        const newPerson = await createPersonFromFace(faceId, data);
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        navigate(`/person/${newPerson.id}`);
        return newPerson;
    };

    const handleProfileAssignmentWrapper = async (faceId: number, personIdToAssign: number) => {
        await setProfileFace(faceId, personIdToAssign);
        loadDetail();
    };

    async function deletePerson() {
        if (!id) return
        const res = await fetch(`${API}/api/persons/${person.id}`, { method: 'DELETE' })
        if (res.ok) {
            showMessage('Person deleted', 'success')
            navigate('/', { replace: true })
        } else {
            showMessage('Failed to delete person', 'error')
        }
        setConfirmDelete(false)
    }

    async function onSave(formDataFromChild: { name: string; age: string; gender: string }) {
        if (!id) return;
        setSaving(true);
        try {
            const payload: any = {
                name: formDataFromChild.name,
                gender: formDataFromChild.gender,
            };
            if (formDataFromChild.age !== '') payload.age = Number(formDataFromChild.age);

            const res = await fetch(`${API}/api/persons/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            await loadDetail();
            showMessage('Saved successfully', 'success');
        } catch (err) {
            console.error(err);
            showMessage('Save failed', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function doMerge(targetId: number) {
        if (!id || Number(id) === targetId) return
        setMergeOpen(false)
        await fetch(`${API}/api/persons/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: Number(id), target_id: targetId })
        })
        navigate(`/person/${targetId}`, { replace: true })
    }

    useEffect(() => {
        if (!mergeOpen || !searchTerm.trim()) return setCandidates([])
        fetch(`${API}/api/persons/?name=${encodeURIComponent(searchTerm)}`)
            .then(r => r.json())
            .then(r => setCandidates(r.items))
    }, [mergeOpen, searchTerm])

    if (loading || !detail) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const { person, medias } = detail
    return (
        <Container maxWidth="xl" sx={{ pt: 2, pb: 6 }}>
            <PersonHero
                person={person}
                onSave={onSave}
                saving={saving}
                onMerge={() => setMergeOpen(true)}
                onDelete={() => setConfirmDelete(true)}
                onRefreshSimilar={loadSimilar}
            />

            <PersonContentTabs
                person={person}
                medias={medias}
                onTagUpdate={loadDetail}
                detectedFacesList={detectedFacesList}
                hasMoreFaces={hasMoreFaces}
                loadingMoreFaces={loadingMoreFaces}
                loadMoreDetectedFaces={loadMoreDetectedFaces}
                handleProfileAssignmentWrapper={handleProfileAssignmentWrapper}
                handleAssignWrapper={handleAssignWrapper}
                handleCreateWrapper={handleCreateWrapper}
                handleDeleteWrapper={handleDeleteWrapper}
                handleDetachWrapper={handleDetachWrapper}
                onLoadSimilar={loadSimilar}
                suggestedFaces={suggestedFaces}
                similarPersons={similarPersons}
            />

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
                    {!READ_ONLY && (
                        <TagAdder ownerType="persons" ownerId={person.id} existingTags={person.tags ?? []} onTagAdded={() => loadDetail()} />
                    )}
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
                                e.stopPropagation()
                                e.preventDefault()
                                fetch(`${API}/api/tags/persons/${person.id}/${tag.id}`, { method: 'DELETE' })
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
