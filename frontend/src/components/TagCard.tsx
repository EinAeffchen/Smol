import React, { useState } from 'react'; // Import useState
import { Link as RouterLink } from 'react-router-dom';
import {
    Card, CardActionArea, CardContent, Typography, Box, AvatarGroup, Avatar,
    IconButton, // For the delete button
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button // For confirmation
} from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete'; // Delete icon
import { Tag } from '../types';

const BG_CARD = '#2C2C2E'
const ACCENT = '#FF2E88'
const TEXT_SECONDARY = '#BFA2DB'
const AVATAR_SIZE = 36
const CARD_HEIGHT = 180

export interface TagCardProps {
    tag: Tag;
    onTagDeleted: (tagId: number) => void; // Callback to notify parent of deletion
}

export default function TagCard({ tag, onTagDeleted }: { tag: TagCardProps }) {
    const API = import.meta.env.VITE_API_BASE_URL ?? ''
    const countMedia = tag.media.length
    const countPeople = tag.persons.length

    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

    const handleOpenConfirmDialog = (event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent the CardActionArea's link navigation
        event.preventDefault();
        setOpenConfirmDialog(true);
    };
    const handleCloseConfirmDialog = () => {
        setOpenConfirmDialog(false);
    };
    const handleConfirmDelete = async () => {
        setOpenConfirmDialog(false);
        try {
            const response = await fetch(`${API}/tags/${tag.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Failed to delete tag:', errorData);
                alert(`Failed to delete tag "${tag.name}". Error: ${response.status}`); // Basic error feedback
                return;
            }
            onTagDeleted(tag.id); // Notify parent component
        } catch (error) {
            console.error('Error during tag deletion:', error);
            alert(`An error occurred while deleting tag "${tag.name}".`); // Basic error feedback
        }
    };

    return (
        <>
            <Card
                elevation={3}
                sx={{
                    bgcolor: BG_CARD,
                    borderRadius: 2,
                    height: CARD_HEIGHT,
                    position: 'relative', // Needed for absolute positioning of the delete button
                    overflow: 'hidden',   // Keep hidden, button will be inside
                }}
            >
                <IconButton
                    aria-label={`Delete tag ${tag.name}`}
                    onClick={handleOpenConfirmDialog}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 2, // Ensure it's above other content
                        color: TEXT_SECONDARY, // Initial subtle color
                        backgroundColor: 'rgba(0, 0, 0, 0.2)', // Optional: slight background for visibility
                        '&:hover': {
                            color: ACCENT, // Brighter color on hover
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        },
                    }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>

                <CardActionArea
                    component={RouterLink}
                    to={`/tag/${tag.id}`}
                    sx={{ height: '100%', display: 'flex' }} // Ensure CardActionArea itself is flex for content alignment
                >
                    <CardContent
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '100%',
                            width: '100%', // Ensure CardContent takes full width of CardActionArea
                            p: 2,
                            // Add some padding top if title might go under the delete button
                            // Or adjust title's margin/padding.
                            // For now, the button is small and in the corner.
                        }}
                    >
                        {/* Tag Name and Counts */}
                        <Box>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: '#FFF',
                                    mb: 1,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    pr: '36px', // Add padding to the right of title to avoid overlap with delete icon
                                }}
                            >
                                {tag.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <MovieIcon fontSize="small" sx={{ color: ACCENT, mr: 0.5 }} />
                                <Typography variant="body2" sx={{ color: TEXT_SECONDARY, mr: 2 }}>
                                    {countMedia}
                                </Typography>
                                <PersonIcon fontSize="small" sx={{ color: ACCENT, mr: 0.5 }} />
                                <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>
                                    {countPeople}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Thumbnails */}
                        <AvatarGroup
                            max={4}
                            sx={{
                                justifyContent: 'flex-start', // Align avatars to the start
                                '& .MuiAvatar-root': {
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: 1, // Square-ish avatars
                                    border: `1px solid ${BG_CARD}` // To distinguish overlapping avatars slightly
                                },
                            }}
                        >
                            {tag.media.slice(0, 4).map(m => (
                                <Avatar
                                    key={`m-${m.id}`}
                                    src={`${API}/thumbnails/${m.id}.jpg`} // Ensure this endpoint works for media
                                    alt={m.filename || 'Media thumbnail'}
                                    variant="rounded"
                                />
                            ))}
                            {tag.persons.slice(0, 4).map(p => p.profile_face?.thumbnail_path && (
                                <Avatar
                                    key={`p-${p.id}`}
                                    src={`${API}${p.profile_face.thumbnail_path}`} // Assuming thumbnail_path might be absolute or needs API prepended
                                    alt={p.name || 'Person thumbnail'}
                                    variant="rounded"
                                />
                            ))}
                        </AvatarGroup>
                    </CardContent>
                </CardActionArea>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog
                open={openConfirmDialog}
                onClose={handleCloseConfirmDialog}
                PaperProps={{ sx: { bgcolor: BG_CARD, color: '#FFF' } }}
            >
                <DialogTitle sx={{ color: ACCENT }}>
                    {`Delete Tag "${tag.name}"?`}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: TEXT_SECONDARY }}>
                        Are you sure you want to permanently delete this tag? All its associations with media and persons will also be removed. This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConfirmDialog} sx={{ color: '#AAA' }}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirmDelete} sx={{ color: ACCENT }} autoFocus>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
