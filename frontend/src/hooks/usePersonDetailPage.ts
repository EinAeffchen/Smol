import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getPerson, getPersonMediaAppearances } from "../services/person";
import {
  deletePerson as deletePersonService,
  getPersonFaces,
  getSimilarPersons,
  getPersonRelationshipGraph,
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
  PersonReadSimple,
  PersonRelationshipGraph,
  SimilarPerson,
  SimilarPersonWithDetails,
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
  const [relationshipGraph, setRelationshipGraph] =
    useState<PersonRelationshipGraph | null>(null);
  const [relationshipDepth, setRelationshipDepth] = useState(3);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [hasLoadedRelationships, setHasLoadedRelationships] = useState(false);

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
    [id],
  );

  const {
    items: detectedFacesList,
    hasMore: hasMoreFaces,
    isLoading: loadingMoreFaces,
  } = useListStore(
    (state) => state.lists[detectedFacesListKey] || defaultListState,
  );

  const { fetchInitial, loadMore, removeItems, clearList } = useListStore();

  const refreshDetectedFaces = useCallback(async () => {
    if (!id || !detectedFacesListKey) return;
    clearList(detectedFacesListKey);
    await fetchInitial(detectedFacesListKey, () =>
      getPersonFaces(Number(id), null, 20),
    );
  }, [id, detectedFacesListKey, clearList, fetchInitial]);

  const refreshMediaAppearances = useCallback(async () => {
    if (!id || !mediaListKey) return;
    const filterIds = filterPeople.map((p) => p.id);
    clearList(mediaListKey);
    await fetchInitial(mediaListKey, () =>
      getPersonMediaAppearances(Number(id), undefined, filterIds),
    );
  }, [id, mediaListKey, filterPeople, clearList, fetchInitial]);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showMessage = (
    message: string,
    severity: "success" | "error" = "success",
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
    [id],
  );

  const loadMoreDetectedFaces = useCallback(
    async (cursor: string | null) => {
      if (!id) return;
      await loadMore(detectedFacesListKey, () =>
        getPersonFaces(Number(id), cursor, 20),
      );
    },
    [id, loadMore, detectedFacesListKey],
  );

  const loadSuggestedFaces = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const data = await getSuggestedFaces(Number(id), signal);
        setSuggestedFaces(data);
      } catch (err) {
        if (signal?.aborted !== true) {
          console.error("Error loading suggested faces:", err);
        }
      }
    },
    [id],
  );

  const loadSimilar = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setSimilarPersons([]);
      try {
        const data: SimilarPersonWithDetails[] = await getSimilarPersons(
          Number(id),
          signal,
        );
        setSimilarPersons(data);
      } catch (error) {
        if (signal?.aborted !== true) {
          console.error("Error loading similarities:", error);
        }
      }
    },
    [id],
  );

  const loadRelationshipGraph = useCallback(
    async (targetDepth?: number, signal?: AbortSignal) => {
      if (!id) return;
      const depthToRequest = targetDepth ?? relationshipDepth;
      setIsLoadingRelationships(true);
      try {
        const graph = await getPersonRelationshipGraph(
          Number(id),
          depthToRequest,
          signal,
        );
        setRelationshipGraph(graph);
        setRelationshipDepth(depthToRequest);
        setHasLoadedRelationships(true);
      } catch (error) {
        if (signal?.aborted !== true) {
          console.error("Error loading relationship graph:", error);
        }
      } finally {
        if (signal?.aborted !== true) {
          setIsLoadingRelationships(false);
        }
      }
    },
    [id, relationshipDepth],
  );

  const invalidateRelationshipGraph = useCallback(() => {
    setRelationshipGraph(null);
    setHasLoadedRelationships(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const initialLoad = async () => {
      if (!id) {
        setPerson(null);
        setLoading(false);
        return;
      }

      setPerson(null);
      setSimilarPersons([]);
      setSuggestedFaces([]);

      setLoading(true);

      if (location.state?.forceRefresh) {
        const baseMediaListKey = `person-${id}-media-appearances-`;
        const facesListKey = `/api/person/${id}/faces`;
        const timelineListKey = `person-${id}-timeline`;
        clearList(baseMediaListKey);
        clearList(facesListKey);
        clearList(timelineListKey);
      }

      try {
        await Promise.all([
          loadDetail(controller.signal),
          loadSuggestedFaces(controller.signal),
        ]);
        await Promise.all([
          refreshDetectedFaces(),
          refreshMediaAppearances(),
        ]);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Initial load failed:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void initialLoad();

    return () => {
      controller.abort();
    };
  }, [
    id,
    location.state,
    clearList,
    loadDetail,
    loadSuggestedFaces,
    refreshDetectedFaces,
    refreshMediaAppearances,
  ]);

  useEffect(() => {
    if (!id) return;
    void refreshMediaAppearances();
  }, [id, filterPeople, refreshMediaAppearances]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    setRelationshipGraph(null);
    setHasLoadedRelationships(false);
    setRelationshipDepth(3);
  }, [id]);

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

  const handleAssignWrapper = async (
    faceIds: number[],
    personId: number,
  ) => {
    if (!id) return;
    try {
      await assignFace(faceIds, personId);
      await Promise.all([refreshDetectedFaces(), loadDetail()]);
      setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
      invalidateRelationshipGraph();
      await refreshMediaAppearances();
    } catch (err) {
      console.error("Failed to assign face:", err);
      showMessage("Failed to assign face", "error");
    }
  };

  const handleDeleteWrapper = async (faceIds: number[]) => {
    try {
      await deleteFace(faceIds);
      removeItems(detectedFacesListKey, faceIds);
      setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
      invalidateRelationshipGraph();
      await Promise.all([refreshMediaAppearances(), loadDetail()]);
    } catch (err) {
      console.error("Failed to delete face:", err);
      showMessage("Failed to delete face", "error");
    }
  };

  const handleDetachWrapper = async (faceIds: number[]) => {
    try {
      await detachFace(faceIds);
      removeItems(detectedFacesListKey, faceIds);
      setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
      invalidateRelationshipGraph();
      await Promise.all([refreshMediaAppearances(), loadDetail()]);
    } catch (err) {
      console.error("Failed to detach face:", err);
      showMessage("Failed to detach face", "error");
    }
  };

  const handleCreateWrapper = async (
    faceIds: number[],
    name?: string,
  ): Promise<Person> => {
    try {
      const newPerson = await createPersonFromFaces(faceIds, name);
      await Promise.all([
        refreshDetectedFaces(),
        loadDetail(),
        refreshMediaAppearances(),
      ]);
      setSuggestedFaces((prev) => prev.filter((f) => !faceIds.includes(f.id)));
      invalidateRelationshipGraph();
      return newPerson;
    } catch (err) {
      console.error("Failed to create person:", err);
      showMessage("Failed to create person", "error");
      throw err;
    }
  };

  const handleProfileAssignmentWrapper = async (
    faceId: number,
    personId: number,
  ) => {
    try {
      await setProfileFace(faceId, personId);
      await loadDetail();
      showMessage("Profile picture updated");
    } catch (err) {
      console.error("Failed to set profile picture:", err);
      showMessage("Failed to set profile picture", "error");
    }
  };

  const handlePersonUpdate = async () => {
    await loadDetail();
  };

  const handleDeletePerson = async () => {
    if (!id) return;
    try {
      await deletePersonService(Number(id));
      showMessage("Person deleted");
      navigate("/people");
    } catch (err) {
      console.error("Failed to delete person:", err);
      showMessage("Failed to delete person", "error");
    }
    setConfirmDelete(false);
  };

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
    relationshipGraph,
    relationshipDepth,
    isLoadingRelationships,
    hasLoadedRelationships,
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
    loadRelationshipGraph,
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
