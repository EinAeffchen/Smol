import { Box, Stack, Typography } from '@mui/material'
import { useRef, useState } from 'react'

import useResizeObserver from '@react-hook/resize-observer'
import { FixedSizeGrid as GridVirtual } from 'react-window'
import { FaceRead, Person } from '../types'
import FaceCard from './FaceCard'

const CARD_WIDTH = 140
const CARD_HEIGHT = 180
const CARD_GAP = 10  // spacing between cards

interface DetectedFacesProps {
    faces: FaceRead[]
    profileFaceId?: number
    horizontal?: boolean
    title: string
    onSetProfile: (faceId: number) => void
    onAssign: (faceId: number, personId: number) => void
    onCreate: (faceId: number, data: any) => Promise<Person>
    onDelete: (faceId: number) => void
}

export default function DetectedFaces({
    faces,
    profileFaceId,
    horizontal = false,
    title = "Detected Faces",
    onSetProfile,
    onAssign,
    onCreate,
    onDelete,
}: DetectedFacesProps) {
    const containerRef = useRef(null)
    const [width, setWidth] = useState(800)

    useResizeObserver(containerRef, (entry) => {
        setWidth(entry.contentRect.width)
    })
    // TODO update to receive person id and load faces via infiniteTag
    const columnCount = Math.max(1, Math.floor(width / CARD_WIDTH))
    const columnWidth = Math.floor(width / columnCount) - 2

    const rowCount = Math.ceil(faces.length / columnCount)
    const gridWidth = Math.min(width, columnCount * CARD_WIDTH)




    return (
        <Box sx={{ my: 4 }}>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>

            {horizontal ? (
                <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', overflowY: "hidden", py: 1 }}>
                    {faces.map(face => (
                        <Box key={face.id} sx={{ flex: '0 0 auto', width: 130 }}>
                            <FaceCard
                                face={face}
                                isProfile={face.id === profileFaceId}
                                onSetProfile={() => onSetProfile(face.id)}
                                onAssign={pid => onAssign(face.id, pid)}
                                onCreate={data => onCreate(face.id, data)}
                                onDelete={() => onDelete(face.id)}
                            />
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Box sx={{ my: 4 }}>
                    <Box
                        ref={containerRef}
                        sx={{ width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}
                    >
                        <GridVirtual
                            columnCount={columnCount}
                            columnWidth={columnWidth}
                            height={500}
                            rowCount={rowCount}
                            rowHeight={CARD_HEIGHT}
                            width={width} // ✅ Use full container width
                        >
                            {({ columnIndex, rowIndex, style }) => {
                                const index = rowIndex * columnCount + columnIndex
                                const face = faces[index]
                                if (!face) return null
                                return (
                                    <Box key={face.id} style={style} sx={{ p: 1 }}>
                                        <FaceCard
                                            face={face}
                                            isProfile={face.id === profileFaceId}
                                            onSetProfile={() => onSetProfile(face.id)}
                                            onAssign={(pid) => onAssign(face.id, pid)}
                                            onCreate={(data) => onCreate(face.id, data)}
                                            onDelete={() => onDelete(face.id)}
                                        />
                                    </Box>
                                )
                            }}
                        </GridVirtual>
                    </Box>
                </Box>
            )}
        </Box>
    )
}
