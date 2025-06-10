import React from 'react';
import { Box, Typography } from '@mui/material';
import { Media, Tag } from '../types';
import { READ_ONLY } from '../config';
import TagAdder from './TagAdder';
import { Tags } from './Tags';

interface TagsSectionProps {
    media: Media;
    onTagAdded: (tag: Tag) => void;
    onUpdate: (updatedMediaObject: Media) => void;
}

export function TagsSection({ media, onTagAdded, onUpdate }: TagsSectionProps) {
    return (
        <Box mt={4}>
            {/* Add Tag Component */}
            {!READ_ONLY && (
                <Box mb={2}>
                    <Typography variant="h6" gutterBottom>Add tag to media</Typography>
                    <TagAdder
                        ownerType="media"
                        ownerId={media.id}
                        existingTags={media.tags ?? []}
                        onTagAdded={onTagAdded}
                    />
                </Box>
            )}

            {/* Display Tags Component */}
            {media.tags && media.tags.length > 0 && (
                <Tags media={media} onUpdate={onUpdate} />
            )}
        </Box>
    );
}