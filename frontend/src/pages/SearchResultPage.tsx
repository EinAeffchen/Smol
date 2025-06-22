import React, { useCallback, useState, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Container, Typography, Box, CircularProgress } from "@mui/material";
import Masonry from "react-masonry-css";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import { API } from "../config";
import { Media, Person, Tag } from "../types";
import MediaCard from "../components/MediaCard";
import PersonCard from "../components/PersonCard";
import TagCard from "../components/TagCard";

const ITEMS_PER_PAGE = 30;

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1200: 5,
  900: 2,
  600: 2,
};

function isMedia(item: any): item is Media {
  return item && "thumbnail_path" in item;
}
function isPerson(item: any): item is Person {
  return item && "profile_face" in item;
}
function isTag(item: any): item is Tag {
  return item && !("tags" in item) && "name" in item;
}

export default function SearchResultsPage() {
  const [deletedItemIds, setDeletedItemIds] = useState<number[]>([]);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const preloadedState = location.state as {
    items: Media[];
    searchType: "image";
  } | null;
  const category =
    (searchParams.get("category") as "media" | "person" | "tag") || "media";
  const query = searchParams.get("query") || "";

  const fetchPage = useCallback(
    (cursor: string | null, limit: number) => {
      // --- UPDATED LOGIC TO CHOOSE THE CORRECT ENDPOINT ---
      let endpointPath = "/api/search/media";
      if (category === "person") {
        endpointPath = "/api/search/people";
      } else if (category === "tag") {
        endpointPath = "/api/search/tags";
      }

      const params = new URLSearchParams({ query });
      params.set("limit", String(limit));
      if (cursor) params.set("cursor", cursor);

      return fetch(`${API}${endpointPath}?${params.toString()}`).then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        // The response is now a simple list of one type of item
        return res.json() as Promise<CursorResponse<Media | Person | Tag>>;
      });
    },
    [category, query]
  );

  const { items, hasMore, loading, loaderRef } = useInfinite<
    Media | Person | Tag
  >(
    fetchPage,
    ITEMS_PER_PAGE,
    [category, query],
    preloadedState?.searchType === "image"
  );

  const displayItems = preloadedState?.items || items;

  const visibleItems = useMemo(() => {
    return items.filter((item) => !displayItems.includes(item.id));
  }, [items, displayItems]);

  const renderItem = (item: Media | Person | Tag) => {
    console.log(item);
    if (isMedia(item)) {
      return <MediaCard media={item} />;
    }
    if (isPerson(item)) {
      return <PersonCard person={item} />;
    }
    if (isTag(item)) {
      return <TagCard onTagDeleted={handleTagDeleted} tag={item} />;
    }
    return null;
  };

  const title =
    preloadedState?.searchType === "image"
      ? "Similar Image Results"
      : `Search Results for "${query}"`;

  const handleTagDeleted = (tagId: number) => {
    setDeletedItemIds((prevIds) => [...prevIds, tagId]);
  };

  return (
    <Container maxWidth="xl" sx={{ pt: 4, pb: 6 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {visibleItems.map((item) => (
          <div key={`${category}-${item.id}`}>{renderItem(item)}</div>
        ))}
      </Masonry>

      {loading && !preloadedState && (
        <Box textAlign="center" py={4}>
          <CircularProgress />
        </Box>
      )}
      {hasMore && !preloadedState && (
        <Box ref={loaderRef} sx={{ height: "1px" }} />
      )}
      {!loading && visibleItems.length === 0 && (
        <Typography sx={{ mt: 4 }}>No results found.</Typography>
      )}
    </Container>
  );
}
