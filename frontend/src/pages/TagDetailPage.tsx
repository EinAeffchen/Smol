import React, { useEffect, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
    Container,
    Box,
    Typography,
    Grid,
} from '@mui/material'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'
import { Tag, Media, Person } from '../types'
import { API } from '../config'

const BG_SECTION = 'background.default'
const TEXT_PRIMARY = 'text.primary'
const ACCENT = 'accent.main'

export default function TagDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [tag, setTag] = useState<Tag | null>(null)

    useEffect(() => {
        if (!id) return
        fetch(`${API}/api/tags/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Tag not found')
                return res.json() as Promise<Tag>
            })
            .then(setTag)
            .catch(console.error)
    }, [id])

    if (!tag) {
        return (
            <Box p={4} textAlign="center">
                <Typography color="text.secondary">Loading…</Typography>
            </Box>
        )
    }

    return (
        <Container maxWidth="lg" sx={{ pt: 4, pb: 6, bgcolor: BG_SECTION, minHeight: '100vh' }}>
            <Typography variant="h4" gutterBottom sx={{ color: ACCENT }}>
                Tag: #{tag.name}
            </Typography>

            {/* Media Section */}
            <Box mb={6}>
                <Typography variant="h5" gutterBottom sx={{ color: TEXT_PRIMARY }}>
                    Media
                </Typography>
                <Grid container spacing={2}>
                    {(tag.media ?? []).map((m: Media) => (
                        <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                            <MediaCard media={m} />
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* People Section */}
            <Box>
                <Typography variant="h5" gutterBottom sx={{ color: TEXT_PRIMARY }}>
                    People
                </Typography>
                <Grid container spacing={2}>
                    {(tag.persons ?? []).map((p: Person) => (
                        <Grid key={p.id} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
                            <Box component={RouterLink} to={`/person/${p.id}`} sx={{ textDecoration: 'none' }}>
                                <PersonCard person={p} />
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Container>
    )
}
