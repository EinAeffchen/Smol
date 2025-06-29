import React, { useCallback, useState, useEffect } from "react";
import {
  Container,
  Typography,
  Grid,
  Box,
  CircularProgress,
} from "@mui/material";
import { useInView } from "react-intersection-observer";
import TagCard from "../components/TagCard";
import { useInfinite, CursorResponse } from "../hooks/useInfinite";
import { Tag } from "../types";
import { useListStore, defaultListState } from "../stores/useListStore";
import { getTags } from "../services/tag";
const ITEMS_PER_PAGE = 20;

export default function TagsPage() {
  const listKey = "tags-all";

  const { items, hasMore, isLoading } = useListStore(
    (state) => state.lists[listKey] || defaultListState
  );
  const { fetchInitial, loadMore, removeItem } = useListStore();

  const { ref: loaderRef, inView } = useInView({ threshold: 0.5 });

  useEffect(() => {
    fetchInitial(listKey, () => getTags(null));
  }, [fetchInitial, listKey]);

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore(listKey, (cursor) => getTags(cursor));
    }
  }, [inView, hasMore, isLoading, loadMore, listKey]);
  const handleTagDeleted = useCallback(
    (deletedTagId: number) => {
      removeItem(listKey, deletedTagId);
    },
    [removeItem, listKey]
  );
  return (
    <Container maxWidth="lg" sx={{ pt: 4, pb: 6 }}>
      <Typography variant="h4" gutterBottom>
        Tags
      </Typography>

      <Grid container spacing={4}>
        {items.map((tag) => (
          <Grid key={tag.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            {/* 1,2,3,4 per row */}
            <TagCard tag={tag} onTagDeleted={handleTagDeleted} />
          </Grid>
        ))}
      </Grid>

      {isLoading && (
        <Box textAlign="center" py={4}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {!isLoading && hasMore && (
        <Box
          ref={loaderRef}
          textAlign="center"
          py={2}
          sx={{ color: "text.secondary" }}
        >
          Scroll to load more…
        </Box>
      )}
    </Container>
  );
}
