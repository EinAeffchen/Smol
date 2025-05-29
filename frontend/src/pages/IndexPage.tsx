import React, { useState, useEffect, useCallback, Fragment } from 'react'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import { MediaIndex, PersonIndex } from '../types'
import MediaCard from '../components/MediaCard'
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material'
import { API, READ_ONLY } from '../config';


console.log(API);
console.log(READ_ONLY);
const ITEMS_PER_PAGE = 20

export default function IndexPage() {
  const [tags, setTags] = useState<string[]>([])
  const [people, setPeople] = useState<PersonIndex[]>([])
  const [sortOrder, setSortOrder] = useState<'newest' | 'latest'>('newest')

  const fetchPage = useCallback(
    (cursor: string | null, limit: number) => {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      params.set('sort', sortOrder)
      tags.forEach(tag => params.append('tags', tag))
      if (cursor) params.set('cursor', cursor)

      return fetch(`${API}/media/?${params.toString()}`).then(res => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json() as Promise<CursorResponse<MediaIndex>>
      })
    },
    [API, sortOrder, tags]
  )

  const {
    items: mediaItems,
    hasMore,
    loading,
    loaderRef,
  } = useInfinite<MediaIndex>(fetchPage, ITEMS_PER_PAGE, [sortOrder, tags])



  useEffect(() => {
    fetch(`${API}/persons/`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setPeople(data))
      .catch(console.error)
  }, [])

  return (
    <Box sx={{ bgcolor: '#1C1C1E', color: '#FFF', minHeight: '100vh', p: 2 }}>
      {/* Sort Toggle */}
      <Box display="flex" justifyContent="center" mb={3}>
        <ToggleButtonGroup
          value={sortOrder}
          exclusive
          onChange={(_, v) => v && setSortOrder(v)}
          sx={{
            bgcolor: '#2C2C2E',
            borderRadius: 2,
          }}
        >
          <ToggleButton
            value="newest"
            sx={{
              color: sortOrder === 'newest' ? '#FF2E88' : '#BFA2DB',
              borderColor: '#5F4B8B',
              '&.Mui-selected': { bgcolor: '#5F4B8B', color: '#FFF' },
            }}
          >
            Created At
          </ToggleButton>
          <ToggleButton
            value="latest"
            sx={{
              color: sortOrder === 'latest' ? '#FF2E88' : '#BFA2DB',
              borderColor: '#5F4B8B',
              '&.Mui-selected': { bgcolor: '#5F4B8B', color: '#FFF' },
            }}
          >
            Inserted At
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          alignItems: 'start',
          mb: 4,
        }}
      >
        {mediaItems.map(media => (
          <Box key={media.id}>
            <MediaCard media={media} />
          </Box>
        ))}
      </Box>


      {/* Loading / Sentinel */}
      {loading && (
        <Box textAlign="center" py={3}>
          <CircularProgress sx={{ color: '#FF2E88' }} />
        </Box>
      )}
      {!loading && hasMore && (
        <Box ref={loaderRef} textAlign="center" py={2} sx={{ color: '#BFA2DB' }}>
          Scroll to load more…
        </Box>
      )}
    </Box>
  )
}
