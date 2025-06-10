import React, { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Container,
    Typography,
    Grid,
    Box,
    CircularProgress,
} from '@mui/material'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'
import TagCard from '../components/TagCard'
import { SearchResult } from '../types'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import { API } from '../config'
const ITEMS_PER_PAGE = 30

export default function SearchResultsPage() {
    const [searchParams] = useSearchParams()
    const category = (searchParams.get('category') as 'media' | 'person' | 'tag') || 'media'
    const query = searchParams.get('query') || ''

    const fetchPage = useCallback(
        (cursor: string | null, limit: number) => {
            const params = new URLSearchParams({ category, query })
            params.set('limit', String(limit))
            if (cursor) params.set('cursor', cursor)
            return fetch(`${API}/api/search/?${params.toString()}`)
                .then(res => {
                    if (!res.ok) throw new Error(res.statusText)
                    return res.json() as Promise<CursorResponse<SearchResult>>
                })
        },
        [category, query]
    )

    const { items: pages, hasMore, loading, loaderRef } = useInfinite<SearchResult>(fetchPage, ITEMS_PER_PAGE, [category, query])

    const mediaList = useMemo(() => pages.flatMap(p => p.media), [pages])
    const peopleList = useMemo(() => pages.flatMap(p => p.persons), [pages])
    const tagList = useMemo(() => pages.flatMap(p => p.tags), [pages])

    // Determine title
    const title =
        category === 'media'
            ? 'Media Results'
            : category === 'person'
                ? 'People Results'
                : 'Tag Results'

    return (
        <Container maxWidth="lg" sx={{ pt: 4, pb: 6, bgcolor: '#1C1C1E' }}>
            <Typography variant="h4" gutterBottom sx={{ color: '#FF2E88' }}>
                {title}
            </Typography>

            <Grid container spacing={2}>
                {category === 'media' &&
                    mediaList.map(m => (
                        <Grid item key={m.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                            <MediaCard media={m} />
                        </Grid>
                    ))}

                {category === 'person' &&
                    peopleList.map(p => (
                        <Grid item key={p.id} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
                            <PersonCard person={p} />
                        </Grid>
                    ))}

                {category === 'tag' &&
                    tagList.map(t => (
                        <Grid item key={t.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                            <TagCard tag={t} />
                        </Grid>
                    ))}
            </Grid>

            {loading && (
                <Box textAlign="center" py={4}>
                    <CircularProgress color="secondary" />
                </Box>
            )}

            {!loading && hasMore && (
                <Box ref={loaderRef} textAlign="center" py={2} sx={{ color: '#BFA2DB' }}>
                    Scroll to load more…
                </Box>
            )}
        </Container>
    )
}
