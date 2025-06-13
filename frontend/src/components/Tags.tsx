import React from 'react'
import { Link } from 'react-router-dom'
import { Media, Tag } from '../types'
import { API } from '../config'
import { Person } from '../types'
import { Chip, Box, Typography } from '@mui/material';
export interface TagsProps {
    media?: Media
    person?: Person
    onUpdate: (updated: Media) => void
}

export function Tags({ media, person, onUpdate }: Readonly<TagsProps>) {
    const owner = media || person;
    if (!owner) {
        return null;
    }

    const handleRemove = async (tagToRemove: Tag) => {
        await fetch(`${API}/api/tags/media/${owner.id}/${tagToRemove.id}`, { method: 'DELETE' })
        onUpdate({
            ...owner,
            tags: owner.tags.filter(t => t.id !== tag.id),
        })
    }
    return (
        <Box component="section" sx={{ mt: 2 }}>
            <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: '600' }}>
                Tags
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(owner.tags ?? []).map(tag => (
                    <Chip
                        key={tag.id}
                        label={tag.name}
                        // This makes the whole chip a clickable link
                        component={Link}
                        to={`/tag/${tag.id}`}
                        clickable
                        // The onDelete prop adds a delete icon and handles the click
                        onDelete={() => handleRemove(tag)}
                        // Use the theme's accent color for a consistent look
                        sx={{
                            color: 'accent.dark',
                            fontWeight: 500,
                            borderColor: 'accent.dark',
                            '& .MuiChip-deleteIcon': {
                                color: 'accent.dark',
                                '&:hover': {
                                    color: 'accent.dark' // A darker shade on hover
                                }
                            }
                        }}
                        variant="outlined"
                    />
                ))}
            </Box>
        </Box>
    );
}
