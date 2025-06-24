import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Box, CircularProgress, Autocomplete, TextField } from "@mui/material";
import Masonry from "react-masonry-css";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import { Media, Person, PersonReadSimple } from "../types";
import MediaCard from "./MediaCard";
import { API } from "../config";

const ITEMS_PER_PAGE = 30;

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
  const [personOptions, setPersonOptions] = useState<PersonReadSimple[]>([]);
  const [filterPeople, setFilterPeople] = useState<PersonReadSimple[]>([]);

  useEffect(() => {
    fetch(`${API}/api/persons/all-simple`)
      .then((res) => res.json())
      .then((data) => {
        // Exclude the current person from the list of options
        setPersonOptions(data.filter((p: Person) => p.id !== person.id));
      })
      .catch((err) => console.error("Failed to fetch person options:", err));
  }, [person.id]);

  const fetchPage = useCallback(
    (cursor: string | null, limit: number) => {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      if (cursor) {
        params.set("cursor", cursor);
      }
      filterPeople.forEach((p) =>
        params.append("with_person_ids", String(p.id))
      );

      const url = `${API}/api/persons/${
        person.id
      }/media-appearances?${params.toString()}`;

      return fetch(url).then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<CursorResponse<Media>>;
      });
    },
    [person.id, filterPeople]
  );

  const { items, hasMore, loading, loaderRef } = useInfinite<Media>(
    fetchPage,
    ITEMS_PER_PAGE,
    [person.id, filterPeople]
  );

  const highlightPersonIds = useMemo(() => {
    const filterIds = filterPeople.map((p) => p.id);

    const uniqueIds = new Set([person.id, ...filterIds]);

    return Array.from(uniqueIds);
  }, [person.id, filterPeople]);
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
            <MediaCard media={media} filterPeople={highlightPersonIds} />
          </div>
        ))}
      </Masonry>

      <Box ref={loaderRef} sx={{ height: "1px" }} />

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
