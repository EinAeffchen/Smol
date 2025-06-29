import React, { useState, useEffect } from "react";
import { Box, CircularProgress, Autocomplete, TextField } from "@mui/material";
import Masonry from "react-masonry-css";
import { useInView } from "react-intersection-observer";

import { Person, PersonReadSimple } from "../types";
import MediaCard from "./MediaCard";
import { useListStore, defaultListState } from "../stores/useListStore";
import { getPeople, getPersonMediaAppearances } from "../services/person";

const breakpointColumnsObj = {
  default: 6,
  1800: 5,
  1500: 4,
  1200: 3,
  900: 2,
  600: 1,
};

interface MediaAppearancesProps {
  person: Person;
  filterPeople: PersonReadSimple[];
  onFilterPeopleChange: (people: PersonReadSimple[]) => void;
  mediaListKey: string;
}
export default function MediaAppearances({
  person,
  filterPeople,
  onFilterPeopleChange,
  mediaListKey,
}: MediaAppearancesProps) {
  const [personOptions, setPersonOptions] = useState<PersonReadSimple[]>([]);

  const { items, hasMore, isLoading } = useListStore(
    (state) => state.lists[mediaListKey] || defaultListState
  );
  const { fetchInitial, loadMore } = useListStore();
  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    getPeople()
      .then((data) => {
        const options = data.items.filter((p) => p.id !== person.id);
        setPersonOptions(options);
      })
      .catch((err) => console.error("Failed to fetch person options:", err));
  }, [person.id]);

  useEffect(() => {
    const filterIds = filterPeople.map((p) => p.id);
    fetchInitial(mediaListKey, () =>
      getPersonMediaAppearances(person.id, undefined, filterIds)
    );
  }, [mediaListKey, fetchInitial, person.id, filterPeople]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      const filterIds = filterPeople.map((p) => p.id);
      loadMore(mediaListKey, (cursor) =>
        getPersonMediaAppearances(person.id, cursor, filterIds)
      );
    }
  }, [
    inView,
    hasMore,
    isLoading,
    loadMore,
    mediaListKey,
    person.id,
    filterPeople,
  ]);

  return (
    <Box>
      <Box sx={{ mb: 2, p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
        <Autocomplete
          multiple
          limitTags={3}
          options={personOptions}
          getOptionLabel={(option) => option.name || `Person ${option.id}`}
          value={filterPeople}
          onChange={(event, newValue) => {
            onFilterPeopleChange(newValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              label="Filter by photos also including..."
              placeholder="Select people"
            />
          )}
        />
      </Box>
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {items.map((media) => (
          <div key={media.id}>
            <MediaCard media={media} mediaListKey={mediaListKey} />
          </div>
        ))}
      </Masonry>

      <Box ref={loaderRef} sx={{ height: "1px" }} />

      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
