import CancelIcon from '@mui/icons-material/Cancel'
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    Paper,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LazyLoadSection from '../components/LazyLoadSection'
import { PersonEditForm } from '../components/PersonEditForm'
import SimilarPersonCard from '../components/SimilarPersonCard'
import TagAdder from '../components/TagAdder'
import { API, READ_ONLY } from '../config'
import { useFaceActions } from '../hooks/useFaceActions'
import { CursorResponse } from '../hooks/useInfinite'
import { FaceRead, Person, PersonDetail, SimilarPerson, SimilarPersonWithDetails, Tag } from '../types'

const DetectedFaces = React.lazy(() => import('../components/DetectedFaces'));
const MediaAppearances = React.lazy(() => import('../components/MediaAppearances'));

const SectionLoader = ({ height = '200px' }: { height?: string }) => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress />
    </Box>
);

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
        setSimilarPersons([]); // Clear previous data
        try {
            const res = await fetch(`${API}/api/persons/${id}/similarities`);
            if (!res.ok) {
                console.error('Failed to fetch similarities:', res.status);
                // Handle error appropriately, maybe set an error state
                return;
            }
            const data: SimilarPersonWithDetails[] = await res.json();
            setSimilarPersons(data);
        } catch (error) {
            console.error('Error loading similarities:', error);
            // Handle error appropriately
        }
    }, [id, API]);

    useEffect(() => {
        if (id) {
            setLoading(true);
            setDetail(null);
            setDetectedFacesList([]);
            setFacesNextCursor(null);
            setHasMoreFaces(true);
            setLoadingMoreFaces(false);
            setSuggestedFaces([]);
            setSimilarPersons([]);

            const initialLoad = async () => {
                await Promise.all([
                    loadDetail(),
                    loadInitialDetectedFaces(id),
                    // loadSuggestedFaces(), // Consider lazy loading these
                    // loadSimilar()       // Consider lazy loading these
                ]);
                // loadSuggestedFaces();
                // loadSimilar();
                setLoading(false);
            };
            initialLoad();
        } else {
            setLoading(false);
            setDetail(null);
            // Clear other states
        }
    }, [id, loadDetail, loadInitialDetectedFaces, loadSimilar, loadSuggestedFaces]); // Add memoized loaders

    const handleAssignWrapper = async (faceId: number, assignedToPersonId: number) => {
        await assignFace(faceId, assignedToPersonId); // Call action from useFaceActions
        if (detail && assignedToPersonId !== detail.person.id) {
            // Face assigned to someone else, remove from this person's list
            setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        } else if (detail && assignedToPersonId === detail.person.id) {
            // Face assigned to THIS person (e.g., from suggestions). Refresh this person's face list.
            if (id) loadInitialDetectedFaces(id); // Or a more targeted update if possible
        }
        // Refresh other relevant data
        loadDetail(); // For profile face changes, etc.
        loadSuggestedFaces(); // A suggestion might have been used
    };

    const handleDeleteWrapper = async (faceId: number) => {
        await deleteFace(faceId);
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        // Also remove from suggestedFaces if it was there (though onDelete is usually on assigned faces)
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        loadDetail(); // Person's face count / profile face might change
    };

    const handleDetachWrapper = async (faceId: number) => {
        await detachFace(faceId);
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        // Also remove from suggestedFaces if it was there (though onDelete is usually on assigned faces)
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        loadDetail(); // Person's face count / profile face might change
    };

    const handleCreateWrapper = async (faceId: number, data: any): Promise<Person> => {
        const newPerson = await createPersonFromFace(faceId, data);
        // The face 'faceId' is now assigned to 'newPerson'.
        // Remove it from the suggestedFaces list of the current person (if it was there).
        setSuggestedFaces(prev => prev.filter(f => f.id !== faceId));
        // If this face was somehow also in detectedFacesList (e.g. if list showed unassigned), remove it.
        setDetectedFacesList(prev => prev.filter(f => f.id !== faceId));
        navigate(`/person/${newPerson.id}`); // Navigate to the newly created person
        return newPerson;
    };

    const handleProfileAssignmentWrapper = async (faceId: number, personIdToAssign: number) => {
        await setProfileFace(faceId, personIdToAssign);
        loadDetail(); // Reload to show the new profile face
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
        <Container maxWidth="lg" sx={{ pt: 2, pb: 6 }}>
            {/* Title and controls */}
            <Grid container alignItems="center" spacing={2} justifyContent="space-between" mb={2}>
                <Grid size={{ xs: 12, md: "auto" }} >
                    <Typography variant="h4">{person.name || 'Unnamed'}</Typography>
                </Grid>
                {!READ_ONLY && (
                    <Grid size={{ xs: 12, md: "auto" }}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button variant="contained" color="secondary" onClick={() => setMergeOpen(true)}>Merge</Button>
                            <Button variant="contained" color="secondary" onClick={() => loadSimilar()}>Refresh Similar Persons</Button>
                            <Button variant="contained" color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>
                        </Stack>
                    </Grid>
                )}
            </Grid>

            {/* Profile  Form as horizontal layout */}
            <Paper sx={{ display: 'flex', p: 3, gap: 4, alignItems: 'center', bgcolor: '#2C2C2E', mb: 4 }}>
                <Avatar
                    src={`${API}/thumbnails/${person.profile_face?.thumbnail_path}`}
                    sx={{ width: 100, height: 100, border: '4px solid #FF2E88' }}
                />

                {person && !READ_ONLY && <PersonEditForm initialPersonData={form} onSave={onSave} saving={saving} />}
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
                                // prevent navigation when clicking the X
                                e.stopPropagation()
                                e.preventDefault()
                                // then do your delete
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

            {/* Media */}
            <Suspense fallback={<SectionLoader />}>
                <MediaAppearances medias={medias}></MediaAppearances>
            </Suspense>

            {/* Detected Faces for THIS person */}
            <Suspense fallback={<SectionLoader />}>
                <DetectedFaces
                    title="Detected Faces"
                    faces={detectedFacesList}
                    profileFaceId={person.profile_face_id}
                    onSetProfile={(faceId) => handleProfileAssignmentWrapper(faceId, person.id)}
                    onAssign={handleAssignWrapper}
                    onCreate={handleCreateWrapper} // Usually not called from THIS list, but from suggestions
                    onDelete={handleDeleteWrapper}
                    onDetach={handleDetachWrapper}
                    onLoadMore={loadMoreDetectedFaces}
                    hasMore={hasMoreFaces}
                    isLoadingMore={loadingMoreFaces}
                />
            </Suspense>
            {/* Show initial loading for detected faces if the list is empty */}
            {loadingMoreFaces && detectedFacesList.length === 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            )}
            {/* Message if no faces found for this person after trying to load */}
            {!loadingMoreFaces && detectedFacesList.length === 0 && !hasMoreFaces && (
                <Box mt={2} sx={{ textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No faces detected for this person.</Typography></Box>
            )}

            {/* Suggested Faces */}
            {!READ_ONLY && (
                <LazyLoadSection onIntersect={loadSuggestedFaces} placeholderHeight="220px">
                    {suggestedFaces.length > 0 && (
                        <Box mt={4}>
                            <DetectedFaces
                                faces={suggestedFaces}
                                title="Is this the same person?"
                                onAssign={handleAssignWrapper}
                                onCreate={handleCreateWrapper}
                                onDelete={handleDeleteWrapper}
                                onDetach={handleDetachWrapper}
                                onSetProfile={() => { }}
                            />
                        </Box>
                    )}
                </LazyLoadSection>
            )}
            {/* Similar People */}
            <LazyLoadSection onIntersect={loadSimilar} placeholderHeight="250px">
                {similarPersons?.length > 0 && (
                    <Box mt={4}>
                        <Typography variant="h6" gutterBottom>Similar People</Typography>
                        <Grid container spacing={2}>
                            {similarPersons.map(p => (
                                <Grid key={p.id} size={{ xs: 6, sm: 6, md: 3, lg: 2 }}>
                                    <SimilarPersonCard {...p} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
            </LazyLoadSection>

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
