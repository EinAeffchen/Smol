// src/pages/TagsPage.tsx
import React, { useCallback, useState, useEffect } from 'react'
import { Container, Typography, Grid, Box, CircularProgress } from '@mui/material'
import TagCard from '../components/TagCard'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import { Tag } from '../types'

const API = import.meta.env.VITE_API_BASE_URL ?? ''
const ITEMS_PER_PAGE = 20

export default function TagsPage() {
  const fetchTags = useCallback(
    (cursor: string | null, limit: number) =>
      fetch(
        `${API}/tags/${cursor ? `?cursor=${cursor}&` : '?'}limit=${limit}`
      ).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch tags: ${res.statusText}`);
        return res.json() as Promise<CursorResponse<Tag>>;
      }),
    [API]
  );

  const {
    items: tags,
    setItems: setTags,
    hasMore,
    loading,
    loaderRef,
  } = useInfinite<Tag>(fetchTags, ITEMS_PER_PAGE, [])

  const [tagsToDisplay, setTagsToDisplay] = useState<Tag[]>([]);

  useEffect(() => {
    setTagsToDisplay(tags);
  }, [tags]);


  const handleTagDeleted = useCallback((deletedTagId: number) => {
    console.log('[TagsPage] handleTagDeleted triggered for tag ID:', deletedTagId);
    setTags(currentTags => {
      const tagsBeforeFilter = currentTags.length;
      const newTags = currentTags.filter(tag => tag.id !== deletedTagId);
      console.log(`[TagsPage] Tags before filter: ${tagsBeforeFilter}, After filter: ${newTags.length}`);
      return newTags;
    });
  }, [setTags]);

  return (
    <Container maxWidth="lg" sx={{ pt: 4, pb: 6 }}>
      <Typography variant="h4" gutterBottom>
        Tags
      </Typography>

      <Grid container spacing={4}>
        {tags.map(tag => (
          <Grid key={tag.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>  {/* 1,2,3,4 per row */}
            <TagCard tag={tag} onTagDeleted={handleTagDeleted} />
          </Grid>
        ))}
      </Grid>

      {loading && (
        <Box textAlign="center" py={4}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {!loading && hasMore && (
        <Box ref={loaderRef} textAlign="center" py={2} sx={{ color: 'text.secondary' }}>
          Scroll to load more…
        </Box>
      )}
    </Container>
  )
}
