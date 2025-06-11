import { Box, Typography } from '@mui/material';
import MediaCard from './MediaCard';
import { Media } from '../types';

export default function MediaAppearances({ medias }: { medias: Media[] }) {
    if (!medias || medias.length === 0) {
        return null;
    }

    return (
        <Box mt={4}>
            <Typography variant="h6" gutterBottom>Media Appearances</Typography>

            <Box
                sx={{
                    columnCount: { xs: 2, sm: 3, md: 3, lg: 4 },
                    columnGap: (theme) => theme.spacing(2),
                }}
            >
                {medias.map(media => (
                    <Box key={media.id} sx={{
                        breakInside: 'avoid',
                        mb: 2
                    }}>
                        <MediaCard media={media} />
                    </Box>
                ))}
            </Box>
        </Box>
    );
}