import React, { useState } from 'react';
import { Box, Typography, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Divider } from '@mui/material';
import { MoreVert, Visibility, Vrpano, Delete } from '@mui/icons-material';
import { Media } from '../types';
import { READ_ONLY } from '../config';

const ERROR_COLOR = 'error.main';

interface MediaHeaderProps {
    media: Media;
    showExif: boolean;
    onToggleExif: () => void;
    onOpenDialog: (type: 'convert' | 'deleteRecord' | 'deleteFile') => void;
}

export function MediaHeader({ media, showExif, onToggleExif, onOpenDialog }: MediaHeaderProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (type: 'convert' | 'deleteRecord' | 'deleteFile') => {
        onOpenDialog(type);
        handleMenuClose();
    };
    const handleExifToggle = () => {
        onToggleExif();
        handleMenuClose();
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 2,
                width: '100%',
            }}
        >

            <Box sx={{ width: { xs: '100%', sm: 'auto' }, textAlign: 'left' }}>
                <Typography
                    variant="h4"
                    component="h1"
                    noWrap // This is key: prevents the text from wrapping to a second line
                    sx={{
                        fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                        // textOverflow: 'ellipsis' is applied by 'noWrap'
                    }}
                >
                    {media.filename}
                </Typography>
            </Box>
            <Box>
                {/* The "More" icon is now the single point of entry for all actions */}
                <IconButton onClick={handleMenuClick}>
                    <MoreVert sx={{ color: 'white' }} />
                </IconButton>

                <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleMenuClose}
                >
                    {/* Item 1: Show/Hide EXIF (always visible) */}
                    <MenuItem onClick={handleExifToggle}>
                        <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
                        <ListItemText>{showExif ? 'Hide EXIF' : 'Show EXIF'}</ListItemText>
                    </MenuItem>

                    {/* The following items are only rendered if the app is NOT in read-only mode */}
                    {!READ_ONLY && (
                        /* Use a Fragment to return multiple items from a conditional block */
                        <>
                            <Divider />
                            {(media.duration) && (
                                <MenuItem onClick={() => handleAction('convert')}>
                                    <ListItemIcon><Vrpano fontSize="small" /></ListItemIcon>
                                    <ListItemText>Convert</ListItemText>
                                </MenuItem>
                            )}
                            <MenuItem onClick={() => handleAction('deleteRecord')} sx={{ color: ERROR_COLOR }}>
                                <ListItemIcon><Delete fontSize="small" sx={{ color: ERROR_COLOR }} /></ListItemIcon>
                                <ListItemText>Delete Record</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => handleAction('deleteFile')} sx={{ color: ERROR_COLOR }}>
                                <ListItemIcon><Delete fontSize="small" sx={{ color: ERROR_COLOR }} /></ListItemIcon>
                                <ListItemText>Delete File</ListItemText>
                            </MenuItem>
                        </>
                    )}
                </Menu>
            </Box>
        </Box >
    );
}