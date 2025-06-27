import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Box, CircularProgress, Autocomplete, TextField } from "@mui/material";
import Masonry from "react-masonry-css";
import { useInView } from "react-intersection-observer";

import { Media, Person, PersonReadSimple } from "../types";
import MediaCard from "./MediaCard";
import { useMediaStore, defaultListState } from "../stores/useMediaStore";
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
}
export default function MediaAppearances({ person }: MediaAppearancesProps) {
  const [filterPeople, setFilterPeople] = useState<PersonReadSimple[]>([]);
  const [personOptions, setPersonOptions] = useState<PersonReadSimple[]>([]);

  const mediaListKey = useMemo(() => {
    const filterIds = filterPeople.map((p) => p.id).sort().join(",");
    return `person-${person.id}-media-appearances-${filterIds}`;
  }, [person.id, filterPeople]);

  const { items, hasMore, isLoading } = useMediaStore(
    (state) => state.lists[mediaListKey] || defaultListState
  );
  const { fetchInitial, loadMore } = useMediaStore();

  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    getPeople(1) // Assuming getPeople can fetch all simple people or takes a page parameter
      .then((data) => {
        setPersonOptions(data.filter((p: Person) => p.id !== person.id));
      })
      .catch((err) => console.error("Failed to fetch person options:", err));
  }, [person.id]);

  useEffect(() => {
    fetchInitial(mediaListKey, () =>
      getPersonMediaAppearances(person.id, 1, filterPeople.map((p) => p.id))
    );
  }, [mediaListKey, fetchInitial, person.id, filterPeople]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(mediaListKey, (page) =>
        getPersonMediaAppearances(person.id, page, filterPeople.map((p) => p.id))
      );
    }
  }, [inView, hasMore, isLoading, loadMore, mediaListKey, person.id, filterPeople]);

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
            setFilterPeople(newValue);
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
