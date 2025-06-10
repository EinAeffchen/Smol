import React from 'react';
import { Box, Paper } from '@mui/material';
import { VideoWithPreview } from './VideoPlayer'; // Assuming this path is correct
import { Media } from '../types';
import { API } from '../config';

interface MediaDisplayProps {
    media: Media;
}

export function MediaDisplay({ media }: MediaDisplayProps) {
    return (
        <Box display="flex" justifyContent="center" mb={2}>
            <Paper elevation={4} sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: 2, bgcolor: '#000' }}>
                {media.duration ? (
                    <VideoWithPreview key={media.id} media={media} />
                ) : (
                    <Box
                        component="img"
                        src={`${API}/originals/${media.path}`}
                        alt={media.filename}
                        sx={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '80vh', // Prevent image from being too tall
                            objectFit: 'contain',
                            display: 'block' // Fixes bottom space issue
                        }}
                    />
                )}
            </Paper>
        </Box>
    );
}