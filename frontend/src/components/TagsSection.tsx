import React from 'react';
import { Box, Typography } from '@mui/material';
import { Media, Person, Tag } from '../types';
import { READ_ONLY } from '../config';
import TagAdder from './TagAdder';
import { Tags } from './Tags';

interface TagsSectionProps {
    media?: Media;
    person?: Person;
    onTagAdded: (tag: Tag) => void;
    onUpdate: (updatedMediaObject: Media) => void;
}

export function TagsSection({ media, person, onTagAdded, onUpdate }: TagsSectionProps) {
    const owner = media || person;
    const ownerType = media ? 'media' : 'persons';
    const tags = owner.tags ?? [];
    const ownerId = owner.id;
    return (
        <Box mt={4}>
            {/* Add Tag Component */}
            {!READ_ONLY && (
                <Box mb={2}>
                    <Typography variant="h6" gutterBottom>Add tag to media</Typography>
                    <TagAdder
                        ownerType={ownerType}
                        ownerId={ownerId}
                        existingTags={tags ?? []}
                        onTagAdded={onTagAdded}
                    />
                </Box>
            )}

            {/* Display Tags Component */}
            {tags && tags.length > 0 && (
                <Tags media={owner} onUpdate={onUpdate} />
            )}
        </Box>
    );
}