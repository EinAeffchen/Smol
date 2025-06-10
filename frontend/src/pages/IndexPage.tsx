import React, { useState, useCallback, Fragment } from 'react';
// import { useInfinite, CursorResponse } from '../hooks/useInfinite'; // Your hook from Step 1
import { useInfinite, CursorResponse } from '../hooks/useInfinite2'; // Your hook from Step 1
import { MediaIndex } from '../types';
import MediaCard from '../components/MediaCard';
import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Container,
} from '@mui/material';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import { API } from '../config';

const ITEMS_PER_PAGE = 20;

export default function IndexPage() {
  const [tags, setTags] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'latest'>('newest');
  const [sortMenuAnchorEl, setSortMenuAnchorEl] = useState<null | HTMLElement>(null);

  const fetchPage = useCallback(
    (cursor: string | null, limit: number) => {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('sort', sortOrder);
      tags.forEach(tag => params.append('tags', tag));
      if (cursor) params.set('cursor', cursor);

      // Ensure your API endpoint name is correct
      return fetch(`${API}/api/media/?${params.toString()}`).then(res => {
        if (!res.ok) throw new Error(res.statusText);
        // Ensure your API returns { items: [], next_cursor: "..." }
        return res.json() as Promise<CursorResponse<MediaIndex>>;
      });
    },
    [sortOrder, tags]
  );

  // We now get `pages` which is an array of arrays
  const { pages, hasMore, loading, loaderRef } = useInfinite<MediaIndex>(fetchPage, ITEMS_PER_PAGE, [sortOrder, tags]);

  const handleSortMenuOpen = (event: React.MouseEvent<HTMLElement>) => { /* ... unchanged ... */ };
  const handleSortMenuClose = () => { /* ... unchanged ... */ };
  const handleSortChange = (newSortOrder: 'newest' | 'latest') => { /* ... unchanged ... */ };

  return (
    <Container maxWidth="xl" sx={{ bgcolor: '#1C1C1E', color: '#FFF', minHeight: '100vh', py: 2 }}>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2}>
        {/* Sort Menu JSX is unchanged */}
      </Box>

      {/*
              This is the implementation of your design. We map over the pages,
              and each page gets its own, independent masonry container.
            */}
      {pages.map((page, pageIndex) => (
        <Box
          key={pageIndex}
          sx={{
            // Apply the multi-column CSS to each page's container
            columnCount: { xs: 2, sm: 3, md: 4, lg: 5, xl: 6 },
            columnGap: (theme) => theme.spacing(2),
            // This creates the "hard gap" between pages
            mb: 2,
          }}
        >
          {page.map(media => (
            <Box key={media.id} sx={{ breakInside: 'avoid', mb: 2 }}>
              <MediaCard media={media} />
            </Box>
          ))}
        </Box>
      ))}

      {/* Loading / Sentinel */}
      {loading && (
        <Box textAlign="center" py={3}>
          <CircularProgress sx={{ color: '#FF2E88' }} />
        </Box>
      )}
      {/* The ref is on a sentinel Box that becomes visible when there's more to load */}
      {hasMore && <Box ref={loaderRef} />}
    </Container>
  );
}