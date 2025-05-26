import { Box, Typography } from '@mui/material'
import { useRef, useState } from 'react'
import { FixedSizeGrid as GridVirtual } from 'react-window'
import useResizeObserver from '@react-hook/resize-observer'
import MediaCard from './MediaCard'  // adjust if needed
import { MediaPreview } from '../types'

const CARD_WIDTH = 240
const CARD_HEIGHT = 180

export function MediaAppearances({ medias }: { medias: MediaPreview[] }) {
    const containerRef = useRef(null)
    const [width, setWidth] = useState(800)

    useResizeObserver(containerRef, (entry) => {
        setWidth(entry.contentRect.width)
    })

    const columnCount = Math.max(1, Math.floor(width / CARD_WIDTH))
    const columnWidth = Math.floor(width / columnCount)-4
    const rowCount = Math.ceil(medias.length / columnCount)

    return (
        <Box mt={4}>
            <Typography variant="h6" gutterBottom>Media Appearances</Typography>

            <Box ref={containerRef} sx={{ width: '100%', overflow: 'hidden' }}>
                <GridVirtual
                    columnCount={columnCount}
                    columnWidth={columnWidth}
                    height={360} // You can adjust this
                    rowCount={rowCount}
                    rowHeight={CARD_HEIGHT}
                    width={width}
                >
                    {({ columnIndex, rowIndex, style }) => {
                        const index = rowIndex * columnCount + columnIndex
                        const media = medias[index]
                        if (!media) return null
                        return (
                            <Box key={media.id} style={style} sx={{ p: 1 }}>
                                <MediaCard media={media} />
                            </Box>
                        )
                    }}
                </GridVirtual>
            </Box>
        </Box>
    )
}
