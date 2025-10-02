import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getPerson, getPersonMediaAppearances } from "../services/person";
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
import {
  assignFace,
  createPersonFromFaces,
  deleteFace,
  detachFace,
} from "../services/faceActions";

export const usePersonDetailPage = () => {
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

  const refreshDetectedFaces = useCallback(async () => {
    if (!id || !detectedFacesListKey) return;
    clearList(detectedFacesListKey);
    await fetchInitial(detectedFacesListKey, () =>
      getPersonFaces(Number(id), null, 20)
    );
  }, [id, detectedFacesListKey, clearList, fetchInitial]);

  const refreshMediaAppearances = useCallback(async () => {
    if (!id || !mediaListKey) return;
    const filterIds = filterPeople.map((p) => p.id);
    clearList(mediaListKey);
    await fetchInitial(mediaListKey, () =>
      getPersonMediaAppearances(Number(id), undefined, filterIds)
    );
  }, [
    id,
    mediaListKey,
    filterPeople,
    clearList,
    fetchInitial,
  ]);

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

    if (id) {
      const baseMediaListKey = `person-${id}-media-appearances-`;
      const facesListKey = `/api/person/${id}/faces`;
      const timelineListKey = `person-${id}-timeline`;

      clearList(baseMediaListKey);
      clearList(facesListKey);
      clearList(timelineListKey);

      if (location.state?.forceRefresh) {
        console.log(`Force refreshing data for person ${id}`);
      }
    }

    const controller = new AbortController();
    const signal = controller.signal;

    if (id) {
      const initialLoad = async () => {
        setLoading(true);
        try {
          await Promise.all([
            loadDetail(signal),
            loadSuggestedFaces(signal),
            getPersonMediaAppearances(Number(id), undefined),
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
  }, [id, loadDetail, loadSuggestedFaces, clearList]);

  useEffect(() => {
    if (detectedFacesListKey) {
      fetchInitial(detectedFacesListKey, () =>
        getPersonFaces(Number(id), null, 20)
      );
    }
  }, [detectedFacesListKey, fetchInitial, id]);

  useEffect(() => {
    if (mediaListKey && id) {
      fetchInitial(mediaListKey, () =>
        getPersonMediaAppearances(
          Number(id),
          undefined,
          filterPeople.map((p) => p.id)
        )
      );
    }
  }, [mediaListKey, fetchInitial, id, filterPeople]);

  const handleAssignWrapper = async (
    faceIds: number[],
    assignedToPersonId: number
  ) => {
    await assignFace(faceIds, assignedToPersonId);
    setSuggestedFaces((prev) =>
      prev.filter((face) => !faceIds.includes(face.id))
    );

    if (assignedToPersonId === Number(id)) {
      await refreshDetectedFaces();
    } else {
      removeItems(detectedFacesListKey, faceIds);
    }

    await refreshMediaAppearances();

    if (id) {
      await Promise.all([loadDetail(), loadSuggestedFaces()]);
    } else {
      await loadSuggestedFaces();
    }
  };

  const handleDeleteWrapper = async (faceIds: number[]) => {
    await deleteFace(faceIds);
    removeItems(detectedFacesListKey, faceIds);
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    await Promise.all([refreshMediaAppearances(), loadDetail()]);
  };

  const handleDetachWrapper = async (faceIds: number[]) => {
    await detachFace(faceIds);
    removeItems(detectedFacesListKey, faceIds);
    setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
    await Promise.all([refreshMediaAppearances(), loadDetail()]);
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
      navigate(`/person/${newPerson.id}`, {
        replace: true,
        state: { forceRefresh: true },
      });
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

    const sourceMediaListKey = `person-${sourceId}-media-appearances-`;

    clearList(sourceMediaListKey);

    setMergeTarget(null);
    setMergeOpen(false);
    try {
      await mergePersons(sourceId, targetId);
      navigate(`/person/${targetId}`, {
        replace: true,
        state: {
          forceRefresh: true,
        },
      });
    } catch (error) {
      console.error("Merge failed:", error);
      showMessage("Merge failed", "error");
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

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

  return {
    id,
    person,
    loading,
    form,
    saving,
    mergeOpen,
    setMergeOpen,
    mergeTarget,
    setMergeTarget,
    searchTerm,
    setSearchTerm,
    candidates,
    similarPersons,
    suggestedFaces,
    filterPeople,
    setFilterPeople,
    mediaListKey,
    detectedFacesList,
    hasMoreFaces,
    loadingMoreFaces,
    snackbar,
    setSnackbar,
    confirmDelete,
    setConfirmDelete,
    loadDetail,
    loadMoreDetectedFaces,
    loadSuggestedFaces,
    loadSimilar,
    handleAssignWrapper,
    handleDeleteWrapper,
    handleDetachWrapper,
    handleCreateWrapper,
    handleProfileAssignmentWrapper,
    handlePersonUpdate,
    handleDeletePerson,
    handleTagAddedToPerson,
    onSave,
    handleConfirmMerge,
  };
};
