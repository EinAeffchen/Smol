import React, { Suspense } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { MediaDetail, Person, Face } from '../types';
import PersonCard from './PersonCard';
import { READ_ONLY } from '../config';

// Lazy load DetectedFaces as before
const DetectedFaces = React.lazy(() => import('./DetectedFaces'));

interface PeopleSectionProps {
    persons: Person[];
    orphans: Face[];
    onAssign: (faceId: number, personId: number) => Promise<void>;
    onCreateFace: (faceId: number, data: any) => Promise<any>;
    onDeleteFace: (faceId: number) => Promise<void>;
    onDetachFace: (faceId: number) => Promise<void>;
}

const SectionLoader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress />
    </Box>
);

export function PeopleSection({
    persons,
    orphans,
    onAssign,
    onCreateFace,
    onDeleteFace,
    onDetachFace,
}: PeopleSectionProps) {
    console.log(persons);
    return (
        <>
            {/* Detected Persons Section */}
            {persons.length > 0 && (
                <Box mb={4}>
                    <Typography variant="h6" gutterBottom>Detected Persons</Typography>
                    <Box sx={{ display: 'flex', overflowX: 'auto', gap: 2, py: 1 }}>
                        {persons.map(p => (
                            // THE FIX: Wrap each card in a Box that defines its width.
                            // This allows the card's internal `aspectRatio` to calculate the height.
                            <Box
                                key={p.id}
                                sx={{
                                    // Give each card a fixed width in the scrolling list.
                                    width: '140px',
                                    // Prevent the card from shrinking if the container gets crowded.
                                    flexShrink: 0,
                                }}
                            >
                                <PersonCard person={p} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Unassigned Faces Section */}
            {orphans.length > 0 && !READ_ONLY && (
                <Box mb={4}>
                    <Suspense fallback={<SectionLoader />}>
                        <DetectedFaces
                            title="Unassigned Faces"
                            faces={orphans}
                            onAssign={onAssign}
                            onSetProfile={() => { alert('No profile to set'); }}
                            onCreate={onCreateFace}
                            onDelete={onDeleteFace}
                            onDetach={onDetachFace}
                        />
                    </Suspense>
                </Box>
            )}
        </>
    );
}