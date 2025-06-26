import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import Masonry from "react-masonry-css";
import { useLocation, useSearchParams } from "react-router-dom";
import MediaCard from "../components/MediaCard";
import PersonCard from "../components/PersonCard";
import TagCard from "../components/TagCard";
import { API } from "../config";
import { CursorResponse, useInfinite } from "../hooks/useInfinite";
import { defaultListState, useMediaStore } from "../stores/useMediaStore";
import { Media, Person, Tag } from "../types";

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
  return (
    item && !("tags" in item) && "name" in item && !("profile_face" in item)
  );
}

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const category =
    (searchParams.get("category") as "media" | "person" | "tag") || "media";
  const query = searchParams.get("query") || "";

  const location = useLocation();
  const preloadedState = location.state as {
    items: Media[];
    searchType: "image";
  } | null;

  const mediaListKey = useMemo(() => {
    if (category !== "media" || !query) return "";
    const params = new URLSearchParams({ query });
    return `${API}/api/search/media?${params.toString()}`;
  }, [category, query]);

  const {
    items: mediaItems,
    hasMore: mediaHasMore,
    isLoading: mediaIsLoading,
  } = useMediaStore((state) => state.lists[mediaListKey] || defaultListState);

  const { fetchInitial, loadMore } = useMediaStore();
  const { ref: inViewRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    if (category === "media" && mediaListKey) {
      fetchInitial(mediaListKey);
    }
  }, [mediaListKey, fetchInitial, category]);

  useEffect(() => {
    if (inView && category === "media" && mediaHasMore && !mediaIsLoading) {
      loadMore(mediaListKey);
    }
  }, [inView, category, mediaHasMore, mediaIsLoading, loadMore, mediaListKey]);

  const fetchOtherPage = useCallback(
    (cursor: string | null, limit: number) => {
      let endpointPath =
        category === "person" ? "/api/search/people" : "/api/search/tags";

      const params = new URLSearchParams({ query });
      params.set("limit", String(limit));
      if (cursor) params.set("cursor", cursor);

      return fetch(`${API}${endpointPath}?${params.toString()}`).then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<CursorResponse<Person | Tag>>;
      });
    },
    [category, query]
  );

  const {
    items: otherItems,
    hasMore: otherHasMore,
    loading: otherIsLoading,
    loaderRef: otherLoaderRef,
  } = useInfinite<Person | Tag>(fetchOtherPage, 30, [category, query]);

  const items = category === "media" ? mediaItems : otherItems;
  const isLoading = category === "media" ? mediaIsLoading : otherIsLoading;
  const hasMore = category === "media" ? mediaHasMore : otherHasMore;
  const loaderRef = category === "media" ? inViewRef : otherLoaderRef;

  const displayItems = preloadedState?.items || items;

  const visibleItems = useMemo(() => {
    return items.filter((item) => !displayItems.includes(item.id));
  }, [items, displayItems]);

  const renderItem = (item: Media | Person | Tag) => {
    if (isMedia(item)) {
      return <MediaCard media={item} mediaListKey={mediaListKey} />;
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

      {isLoading && !preloadedState && (
        <Box textAlign="center" py={4}>
          <CircularProgress />
        </Box>
      )}
      {hasMore && !preloadedState && (
        <Box ref={loaderRef} sx={{ height: "1px" }} />
      )}
      {!isLoading && visibleItems.length === 0 && (
        <Typography sx={{ mt: 4 }}>No results found.</Typography>
      )}
    </Container>
  );
}
