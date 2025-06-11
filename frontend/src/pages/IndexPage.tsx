import React, { useState, useCallback } from 'react';
import { useInfinite, CursorResponse } from '../hooks/useInfinite'; // Your hook from Step 1
// import { useInfinite, CursorResponse } from '../hooks/useInfinite2'; // Your hook from Step 1
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
import Masonry from 'react-masonry-css';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import { API } from '../config';

const ITEMS_PER_PAGE = 20;

const breakpointColumnsObj = {
  default: 5,
  1600: 4,
  1200: 3,
  900: 3,
  600: 2
};

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
  const { items, hasMore, loading, loaderRef } = useInfinite<MediaIndex>(fetchPage, ITEMS_PER_PAGE, [sortOrder, tags]);

  const handleSortMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSortMenuAnchorEl(event.currentTarget);
  };
  const handleSortMenuClose = () => {
    setSortMenuAnchorEl(null);
  };
  const handleSortChange = (newSortOrder: 'newest' | 'latest') => {
    // When changing sort, reset the scroll position memory
    setSortOrder(newSortOrder);
    handleSortMenuClose();
  };

  return (
    <>
      <Container maxWidth="xl" sx={{ bgcolor: '#1C1C1E', color: '#FFF', minHeight: '100vh', py: 2 }}>
        <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2}>
          <IconButton onClick={handleSortMenuOpen} sx={{ color: '#BFA2DB' }}>
            <ImportExportIcon />
          </IconButton>
          <Menu
            anchorEl={sortMenuAnchorEl}
            open={Boolean(sortMenuAnchorEl)}
            onClose={handleSortMenuClose}
          >
            <MenuItem onClick={() => handleSortChange('newest')} selected={sortOrder === 'newest'}>
              Sort by Created At
            </MenuItem>
            <MenuItem onClick={() => handleSortChange('latest')} selected={sortOrder === 'latest'}>
              Sort by Inserted At
            </MenuItem>
          </Menu>
        </Box>

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

        {/* Loading / Sentinel */}
        {loading && (
          <Box textAlign="center" py={3}>
            <CircularProgress sx={{ color: '#FF2E88' }} />
          </Box>
        )}
        {hasMore && <Box ref={loaderRef} />}
      </Container>
    </>
  );
}