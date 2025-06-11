import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { MediaPreview } from '../types';
import MediaCard from './MediaCard';
import { API } from '../config';

export default function SimilarContent({ mediaId }: { mediaId: number }) {
    const [similar, setSimilar] = useState<MediaPreview[]>([]);

    useEffect(() => {
        if (!mediaId) return;
        fetch(`${API}/api/media/${mediaId}/get_similar`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load similar media');
                return res.json() as Promise<MediaPreview[]>;
            })
            .then(setSimilar)
            .catch(console.error);
    }, [mediaId]);

    if (similar.length === 0) return null;

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Similar Content
            </Typography>

            {/*
              CHANGED: Replaced the <Grid> component with a <Box> using
              the pure CSS Multi-column Masonry layout for a consistent look.
            */}
            <Box
                sx={{
                    columnCount: { xs: 2, sm: 2, md: 3 }, // Responsive column count, adjusted for this section
                    columnGap: (theme) => theme.spacing(2), // Horizontal gap between columns
                }}
            >
                {similar.map(item => (
                    // This wrapper Box is essential for the column layout to work correctly
                    <Box key={item.id} sx={{
                        breakInside: 'avoid', // Prevents a card from splitting across columns
                        mb: 2,               // Vertical gap between cards in the same column
                    }}>
                        <MediaCard media={item} />
                    </Box>
                ))}
            </Box>
        </Box>
    );
}