import React, { useEffect, useState } from 'react'
import { Box, Typography, Grid } from '@mui/material'
import { MediaPreview } from '../types'
import MediaCard from './MediaCard'
import { API } from '../config'

export default function SimilarContent({ mediaId }: { mediaId: number }) {
    const [similar, setSimilar] = useState<MediaPreview[]>([])

    useEffect(() => {
        fetch(`${API}/api/media/${mediaId}/get_similar`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load similar media')
                return res.json() as Promise<MediaPreview[]>
            })
            .then(setSimilar)
            .catch(console.error)
    }, [mediaId])

    if (similar.length === 0) return null

    return (
        <Box mt={4}>
            <Typography variant="h6" gutterBottom>
                Similar Content
            </Typography>
            <Grid container spacing={2}>
                {similar.map(item => (
                    <Grid key={item.id} size={{ xs: 4, sm: 3, md: 3 }}>
                        <MediaCard key={item} media={item} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    )
}