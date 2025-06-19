import React, { useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import Masonry from 'react-masonry-css';
import { useInfinite, CursorResponse } from '../hooks/useInfinite';
import { Media, Person } from '../types';
import MediaCard from './MediaCard';
import { API } from '../config';

const ITEMS_PER_PAGE = 30;

const breakpointColumnsObj = {
  default: 6,
  1800: 5,
  1500: 4,
  1200: 3,
  900: 2,
  600: 1
};

interface MediaAppearancesProps {
  person: Person;
}
export default function MediaAppearances({ person }: MediaAppearancesProps) {
  const fetchPage = useCallback(
    (cursor: string | null, limit: number) => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      if (cursor) {
        params.set('cursor', cursor);
      }
      
      const url = `${API}/api/persons/${person.id}/media-appearances?${params.toString()}`;
      
      return fetch(url).then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<CursorResponse<Media>>;
      });
    },
    [person.id] // Re-fetch if the person changes
  );

  const { items, hasMore, loading, loaderRef } = useInfinite<Media>(
    fetchPage, 
    ITEMS_PER_PAGE, 
    [person.id] // Dependency array for useInfinite to reset on person change
  );

  return (
    <Box>
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {items.map(media => (
          <div key={media.id}>
            <MediaCard media={media} />
          </div>
        ))}
      </Masonry>

      <Box ref={loaderRef} sx={{ height: '1px' }} />

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
