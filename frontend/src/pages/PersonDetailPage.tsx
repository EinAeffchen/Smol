import {
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PersonContentTabs } from "../components/PersonContentTabs";
import { PersonHero } from "../components/PersonHero";
import { useMediaStore, defaultListState } from "../stores/useMediaStore"; // Import the store
import { getPerson } from "../services/person";
import {
  assignFace,
  createPersonFromFaces,
  deleteFace,
  detachFace,
} from "../services/faceActions";
import { PageResponse } from "../hooks/useInfinite";
import { setProfileFace } from "../services/personActions";
import {
  FaceRead,
  Person,
  SimilarPerson,
  Media,
  SimilarPersonWithDetails,
} from "../types";
import {
  updatePerson,
  deletePerson as deletePersonService,
  mergePersons,
  searchPersonsByName,
  getSuggestedFaces,
  getSimilarPersons,
  getPersonFaces,
} from "../services/personActions";

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);

  // States for the paginated "Detected Faces" section
  const [detectedFacesList, setDetectedFacesList] = useState<FaceRead[]>([]);
  const [facesNextCursor, setFacesNextCursor] = useState<string | null>(null);
  const [loadingMoreFaces, setLoadingMoreFaces] = useState<boolean>(false);
  const [hasMoreFaces, setHasMoreFaces] = useState<boolean>(true);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [similarPersons, setSimilarPersons] = useState<SimilarPerson[]>([]);
  const [suggestedFaces, setSuggestedFaces] = useState<FaceRead[]>([]);

  const baseUrl = useMemo(() => {
    if (!id) return "";
    return `/api/persons/${id}/media-appearances?`;
  }, [id]);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showMessage = (
    message: string,
    severity: "success" | "error" = "success"
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const personData = await getPerson(id);
        setPerson(personData);
        setForm({
          name: personData.name ?? "",
        });
      } catch (err) {
        if (signal?.aborted !== true) {
          console.error("Error in loadDetail:", err);
        }
      }
    },
    [id]
  );

  const fetchFacesPage = useCallback(
    async (
      personId: string,
      cursor: string | null,
      limit: number = 20,
      signal?: AbortSignal
    ): Promise<PageResponse<FaceRead> | null> => {
      try {
        const data = await getPersonFaces(Number(personId), cursor, limit);
        return { items: data.items, next_page: data.next_cursor };
      } catch (error) {
        console.error(`Error fetching faces for person ${personId}:`, error);
        return null;
      }
    },
    []
  );

  const loadInitialDetectedFaces = useCallback(
    async (personId: string, signal?: AbortSignal) => {
      if (!personId) return;
      setLoadingMoreFaces(true);
      setDetectedFacesList([]);
      setFacesNextCursor(null);
      setHasMoreFaces(true);

      const pageData = await fetchFacesPage(personId, null, 20, signal);
      if (pageData) {
        setDetectedFacesList(pageData.items);
        setFacesNextCursor(pageData.next_page);
        setHasMoreFaces(!!pageData.next_page && pageData.items.length > 0);
      } else {
        setHasMoreFaces(false);
      }
      setLoadingMoreFaces(false);
    },
    [fetchFacesPage]
  );

  const loadMoreDetectedFaces = useCallback(
    async () => {
      if (!id || !facesNextCursor || loadingMoreFaces || !hasMoreFaces) return;
      setLoadingMoreFaces(true);

      const pageData = await fetchFacesPage(id, facesNextCursor, 20);
      if (pageData?.items) {
        setDetectedFacesList((prevFaces) => [...prevFaces, ...pageData.items]);
        setFacesNextCursor(pageData.next_page);
        setHasMoreFaces(!!pageData.next_page && pageData.items.length > 0);
      } else {
        setHasMoreFaces(false);
      }
      setLoadingMoreFaces(false);
    },
    [id, facesNextCursor, loadingMoreFaces, hasMoreFaces, fetchFacesPage]
  );

  const loadSuggestedFaces = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const data = await getSuggestedFaces(Number(id));
        setSuggestedFaces(data);
      } catch (err) {
        console.error(err);
      }
    },
    [id]
  );

  const loadSimilar = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setSimilarPersons([]);
      try {
        const data: SimilarPersonWithDetails[] = await getSimilarPersons(
          Number(id)
        );
        setSimilarPersons(data);
      } catch (error) {
        console.error("Error loading similarities:", error);
      }
    },
    [id]
  );

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    if (id) {
      const initialLoad = async () => {
        setLoading(true);
        try {
          // Pass the signal to each fetch call
          await Promise.all([
            loadDetail(signal),
            loadInitialDetectedFaces(id, signal),
            loadSuggestedFaces(signal),
            loadSimilar(signal),
          ]);
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Initial load failed:", err);
          }
        } finally {
          if (!signal.aborted) {
            setLoading(false);
          }
        }
      };
      initialLoad();
    } else {
      setLoading(false);
      setPerson(null);
    }

    return () => {
      controller.abort();
    };
  }, [id]);

  const handleAssignWrapper = async (
    faceIds: number[],
    assignedToPersonId: number
  ) => {
    await assignFace(faceIds, assignedToPersonId);
    if (id) {
      loadInitialDetectedFaces(id);
      loadSuggestedFaces();
      loadDetail();
    }
  };

  const handleDeleteWrapper = async (faceIds: number[]) => {
    await deleteFace(faceIds);
    // Filter out all deleted faces from both lists
    setDetectedFacesList((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    loadDetail();
  };

  const handleDetachWrapper = async (faceIds: number[]) => {
    await detachFace(faceIds);
    // Filter out all detached faces from both lists
    setDetectedFacesList((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    loadDetail();
  };

  const handleCreateWrapper = async (
    faceIds: number[],
    name: string
  ): Promise<Person> => {
    const newPerson = await createPersonFromFaces(faceIds, name);
    setSuggestedFaces((prev) => prev.filter((f) => f.id !== faceId));
    setDetectedFacesList((prev) => prev.filter((f) => f.id !== faceId));
    navigate(`/person/${newPerson.id}`);
    return newPerson;
  };

  const handleProfileAssignmentWrapper = async (
    faceId: number,
    personIdToAssign: number,
    signal?: AbortSignal
  ) => {
    await setProfileFace(faceId, personIdToAssign);
    loadDetail(signal);
  };

  async function handleDeletePerson() {
    if (!id || !person) return;
    try {
      await deletePersonService(person.id);
      showMessage("Person deleted", "success");
      navigate("/", { replace: true });
    } catch (error) {
      showMessage("Failed to delete person", "error");
    }
    setConfirmDelete(false);
  }

  async function onSave(formDataFromChild: { name: string }) {
    if (!id) return;
    setSaving(true);
    try {
      await updatePerson(Number(id), { name: formDataFromChild.name });
      await loadDetail();
      showMessage("Saved successfully", "success");
    } catch (err) {
      console.error(err);
      showMessage("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmMerge() {
    if (!id || !mergeTarget) return;

    const targetId = mergeTarget.id;

    setMergeTarget(null);
    setMergeOpen(false);
    console.log(`SOURCE: ${Number(id)}`);
    console.log(`TARGET: ${targetId}`);
    try {
      await mergePersons(Number(id), targetId);
      navigate(`/person/${targetId}`, { replace: true });
    } catch (error) {
      console.error("Merge failed:", error);
      showMessage("Merge failed", "error");
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after the user stops typing

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!mergeOpen || !debouncedSearchTerm.trim()) {
      setCandidates([]);
      return;
    }

    const controller = new AbortController();
    searchPersonsByName(debouncedSearchTerm)
      .then((response) => {
        const filtered = response.filter((p: Person) => p.id !== Number(id));
        setCandidates(filtered);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Search failed:", err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearchTerm, mergeOpen, id]);

  if (loading || !person) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

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
        onTagUpdate={loadDetail}
        onTagAdded={(updatedPerson: Person) => setPerson(updatedPerson)}
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
        onRefreshSuggestions={loadSuggestedFaces}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          sx={{ width: "100%" }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
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
          <Button
            onClick={handleDeletePerson}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mergeTarget !== null} onClose={() => setMergeTarget(null)}>
        <DialogTitle>Confirm Merge</DialogTitle>
        <DialogContent>
          <Typography>
            {/* Display both names for clarity */}
            Are you sure you want to merge "{person.name}" into "
            {mergeTarget?.name}"?
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeTarget(null)}>Cancel</Button>
          <Button
            onClick={handleConfirmMerge}
            color="primary"
            variant="contained"
          >
            Confirm Merge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)}>
        <DialogTitle>Merge "{person.name}" into…</DialogTitle>
        <DialogContent>
          <TextField
            label="Search by name…"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Stack spacing={1}>
            {candidates.map((c) => (
              <Box
                key={c.id}
                onClick={() =>
                  setMergeTarget({ id: c.id, name: c.name ?? "Unknown" })
                }
                sx={{
                  p: 1,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "primary.dark" },
                }}
              >
                <Typography>{c.name ?? "Unknown"}</Typography>
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
  );
}
