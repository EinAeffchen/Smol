import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Box, CircularProgress, Autocomplete, TextField } from "@mui/material";
import Masonry from "react-masonry-css";
import { useInView } from "react-intersection-observer";

import { Media, Person, PersonReadSimple } from "../types";
import MediaCard from "./MediaCard";
import { API } from "../config";
import { useMediaStore, defaultListState } from "../stores/useMediaStore";

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

  const baseUrl = useMemo(() => {
    const params = new URLSearchParams();
    filterPeople.forEach((p) => params.append("with_person_ids", String(p.id)));
    return `${API}/api/persons/${
      person.id
    }/media-appearances?${params.toString()}`;
  }, [person.id, filterPeople]);

  const { items, hasMore, isLoading } = useMediaStore(
    (state) => state.lists[baseUrl] || defaultListState
  );
  const { fetchInitial, loadMore } = useMediaStore();

  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    fetch(`${API}/api/persons/all-simple`)
      .then((res) => res.json())
      .then((data) => {
        setPersonOptions(data.filter((p: Person) => p.id !== person.id));
      })
      .catch((err) => console.error("Failed to fetch person options:", err));
  }, [person.id]);

  useEffect(() => {
    fetchInitial(baseUrl);
  }, [baseUrl, fetchInitial]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(baseUrl);
    }
  }, [inView, hasMore, isLoading, loadMore, baseUrl]);

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
            <MediaCard media={media} mediaListKey={baseUrl} />
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
