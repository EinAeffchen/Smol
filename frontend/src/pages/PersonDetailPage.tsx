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
import { useLocation } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PersonContentTabs } from "../components/PersonContentTabs";
import { PersonHero } from "../components/PersonHero";
import {
  assignFace,
  createPersonFromFaces,
  deleteFace,
  detachFace,
} from "../services/faceActions";
import { getPerson } from "../services/person";
import {
  deletePerson as deletePersonService,
  getPersonFaces,
  getSimilarPersons,
  getSuggestedFaces,
  mergePersons,
  searchPersonsByName,
  setProfileFace,
  updatePerson,
} from "../services/personActions";
import { defaultListState, useListStore } from "../stores/useListStore";
import {
  FaceRead,
  Person,
  SimilarPerson,
  SimilarPersonWithDetails,
  PersonReadSimple,
  Tag,
} from "../types";

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "" });
  const [saving, setSaving] = useState(false);

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

  const [filterPeople, setFilterPeople] = useState<PersonReadSimple[]>([]);

  const mediaListKey = useMemo(() => {
    const filterIds = filterPeople
      .map((p) => p.id)
      .sort()
      .join(",");
    // The key must be unique to the person and the filters applied
    return `person-${id}-media-appearances-${filterIds}`;
  }, [id, filterPeople]);

  const detectedFacesListKey = useMemo(
    () => (id ? `/api/person/${id}/faces` : ""),
    [id]
  );

  const {
    items: detectedFacesList,
    hasMore: hasMoreFaces,
    isLoading: loadingMoreFaces,
  } = useListStore(
    (state) => state.lists[detectedFacesListKey] || defaultListState
  );

  const { fetchInitial, loadMore, removeItems, clearList } = useListStore();

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
        const personData = await getPerson(id, signal);
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

  const loadMoreDetectedFaces = useCallback(() => {
    if (detectedFacesListKey) {
      loadMore(detectedFacesListKey, (cursor) =>
        getPersonFaces(Number(id), cursor, 20)
      );
    }
  }, [detectedFacesListKey, loadMore, id]);

  const loadSuggestedFaces = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const data = await getSuggestedFaces(Number(id), signal);
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
          Number(id),
          signal
        );
        setSimilarPersons(data);
      } catch (error) {
        console.error("Error loading similarities:", error);
      }
    },
    [id]
  );

  useEffect(() => {
    setPerson(null);
    setLoading(true);

    if (location.state?.forceRefresh && id) {
      console.log(`Force refreshing data for person ${id}`);
      // Define all list keys that this page and its children use
      const mediaListKey = `person-${id}-media-appearances`;
      const facesListKey = `/api/person/${id}/faces`;
      const timelineListKey = `person-${id}-timeline`;

      // Clear them from the cache
      clearList(mediaListKey);
      clearList(facesListKey);
      clearList(timelineListKey);
    }

    const controller = new AbortController();
    const signal = controller.signal;

    if (id) {
      const initialLoad = async () => {
        setLoading(true);
        try {
          // Pass the signal to each fetch call
          await Promise.all([loadDetail(signal), loadSuggestedFaces(signal)]);
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
  }, [id, loadDetail, loadSuggestedFaces]);

  useEffect(() => {
    if (detectedFacesListKey) {
      fetchInitial(detectedFacesListKey, () =>
        getPersonFaces(Number(id), null, 20)
      );
    }
  }, [detectedFacesListKey, fetchInitial, id]);

  const handleAssignWrapper = async (
    faceIds: number[],
    assignedToPersonId: number
  ) => {
    await assignFace(faceIds, assignedToPersonId);
    clearList(mediaListKey);
    if (id) {
      loadSuggestedFaces();
      loadDetail();
    }
  };

  const handleDeleteWrapper = async (faceIds: number[]) => {
    await deleteFace(faceIds);
    removeItems(detectedFacesListKey, faceIds);
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    loadDetail();
  };

  const handleDetachWrapper = async (faceIds: number[]) => {
    await detachFace(faceIds);
    clearList(mediaListKey);
    removeItems(detectedFacesListKey, faceIds);
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    loadDetail();
  };

  const handleCreateWrapper = async (
    faceIds: number[],
    name?: string
  ): Promise<Person> => {
    const newPerson = await createPersonFromFaces(faceIds, name);
    removeItems(detectedFacesListKey, faceIds);

    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));

    if (newPerson?.id) {
      const newPersonMediaListKey = `person-${newPerson.id}-media-appearances`;
      clearList(newPersonMediaListKey);

      navigate(`/person/${newPerson.id}`, { replace: true });
    }
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

  const handlePersonUpdate = (updatedPerson: Person) => {
    setPerson(updatedPerson);
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
  const handleTagAddedToPerson = (newTag: Tag) => {
    setPerson((prevPerson) => {
      if (!prevPerson) return null;

      const updatedTags = [...(prevPerson.tags || []), newTag];

      return { ...prevPerson, tags: updatedTags };
    });
  };

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

    const sourceId = Number(id);
    const targetId = mergeTarget.id;

    const sourceMediaListKey = `person-${sourceId}-media-appearances`;
    const targetMediaListKey = `/api/person/${targetId}/media-appearances`;

    clearList(sourceMediaListKey);
    clearList(targetMediaListKey);

    setMergeTarget(null);
    setMergeOpen(false);
    try {
      await mergePersons(sourceId, targetId);
      navigate(`/person/${targetId}`, {
        replace: true,
      });
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
        onTagUpdate={(person: Person) => handlePersonUpdate(person)}
        onTagAdded={(tag: Tag) => handleTagAddedToPerson(tag)}
        detectedFacesList={detectedFacesList}
        hasMoreFaces={hasMoreFaces}
        loadingMoreFaces={loadingMoreFaces}
        loadMoreDetectedFaces={loadMoreDetectedFaces}
        handleProfileAssignmentWrapper={handleProfileAssignmentWrapper}
        handleAssignWrapper={handleAssignWrapper}
        handleDeleteWrapper={handleDeleteWrapper}
        handleDetachWrapper={handleDetachWrapper}
        onLoadSimilar={loadSimilar}
        suggestedFaces={suggestedFaces}
        similarPersons={similarPersons}
        onRefreshSuggestions={loadSuggestedFaces}
        handleCreateWrapper={handleCreateWrapper}
        filterPeople={filterPeople}
        onFilterPeopleChange={setFilterPeople}
        mediaListKey={mediaListKey}
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
