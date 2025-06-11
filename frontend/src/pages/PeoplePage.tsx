import React, { useCallback } from 'react'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'
import PersonCard from '../components/PersonCard'
import { Person } from '../types'
import {
    Container,
    Box,
    Typography,
    Grid,
    CircularProgress,
} from '@mui/material'
import { ENABLE_PEOPLE } from '../config'
import { API } from '../config'

const ITEMS_PER_PAGE = 12

export default function PeoplePage() {
    const fetchPeople = useCallback(
        (cursor: string | null, limit: number) =>
            fetch(
                `${API}/api/persons/${cursor ? `?cursor=${cursor}&` : '?'}limit=${limit}`
            ).then(res => {
                if (!res.ok) throw new Error(res.statusText)
                return res.json() as Promise<CursorResponse<Person>>
            }),
        [API]
    )

    const {
        items: people,
        setItems: setPeople,
        hasMore,
        loading,
        loaderRef,
    } = useInfinite<Person>(fetchPeople, ITEMS_PER_PAGE, [])

    if (loading && people.length === 0) {
        return (
            <Box textAlign="center" py={4}>
                <CircularProgress color="secondary" />
            </Box>
        )
    }
    if (!ENABLE_PEOPLE) {
        return (
            <Typography variant="h5" color="text.primary" gutterBottom>
                People disabled!
            </Typography>
        )
    }

    return (
        <Container maxWidth={false} sx={{ pt: 4, pb: 6, bgcolor: '#1C1C1E', px: 4 }}>
            <Typography variant="h5" color="text.primary" gutterBottom>
                People
            </Typography>

            <Grid container spacing={3} alignItems="stretch">
                {people.map(person => (
                    <Grid key={person.id} size={{ xs: 6, sm: 4, md: 2, lg: 1.5, }}>
                        <PersonCard person={person} />
                    </Grid>
                ))}
            </Grid>

            {loading && (
                <Box textAlign="center" py={2}>
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
