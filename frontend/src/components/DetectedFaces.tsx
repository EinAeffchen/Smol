import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Stack, Typography, CircularProgress } from '@mui/material'; // Added CircularProgress
import { FaceRead, Person } from '../types';
import FaceCard from './FaceCard';

interface DetectedFacesProps {
    faces: FaceRead[];
    profileFaceId?: number;
    title: string;
    onSetProfile: (faceId: number) => void;
    onAssign: (faceId: number, personId: number) => void;
    onCreate: (faceId: number, data: any) => Promise<Person>; // Or appropriate return type
    onDelete: (faceId: number) => void;
    onDetach: (faceId: number) => void;
    onLoadMore?: () => void;         // Optional: Function to call to load more
    hasMore?: boolean;               // Optional: Boolean indicating if more items can be loaded
    isLoadingMore?: boolean;         // Optional: Boolean indicating if currently loading more
}

export default function DetectedFaces({
    faces,
    profileFaceId,
    title, // Removed default as parent now always provides it
    onSetProfile,
    onAssign,
    onCreate,
    onDelete,
    onDetach,
    onLoadMore,
    hasMore,
    isLoadingMore,
}: DetectedFacesProps) {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastCardRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isLoadingMore) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && hasMore && onLoadMore && !isLoadingMore) {
                        onLoadMore();
                    }
                },
                { threshold: 0.1, rootMargin: '0px 0px 100px 0px' } // Trigger when 100px from bottom
            );

            if (node) observerRef.current.observe(node);
        },
        [isLoadingMore, hasMore, onLoadMore]
    );

    // If no faces and not in the initial loading phase (for this specific list, parent handles initial spinner)
    if (faces.length === 0 && !isLoadingMore && !hasMore && title === "Detected Faces") {
        // This specific check might be better handled by the parent based on initial load status
        // For now, if faces is empty, this component might just render nothing or a minimal message if passed.
        // The parent PersonDetailPage has better logic for "No faces detected for this person."
        return null;
    }
    // If parent passes empty faces and is loading initial, don't show the title yet.
    // The parent handles the main spinner for initial load.
    if (faces.length === 0 && isLoadingMore && onLoadMore) { // Check onLoadMore to ensure this is the paginated list
        return null; // Parent will show overall loading or specific loading for this list
    }


    return (
        <Box sx={{ my: 4 }}>
            <Typography variant="h6" gutterBottom>
                {title} ({faces.length}) {/* Optionally show count */}
            </Typography>

            <Stack
                direction="row"
                spacing={2}
                sx={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    py: 1,
                    pr: 2, // Padding at the end for the potential loader to be visible
                    position: 'relative', // For absolute positioning of a loader if needed
                }}
            >
                {faces.map((face, index) => (
                    <Box
                        key={face.id}
                        // Attach ref to one of the later elements to trigger load more
                        // e.g., the 5th from the end, or simply the last one if list isn't excessively long per page
                        ref={index === faces.length - 1 && hasMore && onLoadMore ? lastCardRef : null}
                        sx={{ flex: '0 0 auto', width: 130 }}
                    >
                        <FaceCard
                            face={face}
                            isProfile={face.id === profileFaceId}
                            onSetProfile={() => onSetProfile(face.id)}
                            onAssign={(personId) => onAssign(face.id, personId)}
                            onCreate={(data) => onCreate(face.id, data)}
                            onDelete={() => onDelete(face.id)}
                            onDetach={() => onDetach(face.id)}
                        />
                    </Box>
                ))}
                {isLoadingMore && onLoadMore && ( // Show loader only if it's for this paginated list
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '60px', pl: 1 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Stack>
        </Box>
    );
}