import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardActionArea, CardMedia, Box, Typography } from '@mui/material'
import { Media } from '../types'

function formatDuration(d?: number): string {
  if (d == null) return ''
  const m = Math.floor(d / 60)
  const s = Math.round(d % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function MediaCard({ media }: { media: Media }) {
  const API = import.meta.env.VITE_API_BASE_URL
  const isVideo = typeof media.duration === 'number'
  const mediaUrl = `/originals/${media.path}`
  const thumbUrl = `/thumbnails/${media.id}.jpg`
  const [hovered, setHovered] = useState(false)

  return (
    <Card
      elevation={4}
      sx={{
        bgcolor: '#2C2C2E',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <CardActionArea
        component={Link}
        to={`/media/${media.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          display: 'block',
        }}
      >
        {isVideo ? (
          hovered ? (
            <CardMedia
              component="video"
              src={mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              sx={{
                aspectRatio: '4/3',
                objectFit: 'cover',
                width: '100%',
                maxHeight: "100%"
              }}
            />
          ) : (
            <CardMedia
              component="img"
              image={thumbUrl}
              alt={media.filename}
              sx={{
                aspectRatio: '4/3',
                objectFit: 'cover',
              }}
            />
          )
        ) : (
          <CardMedia
            component="img"
            image={thumbUrl}
            alt={media.filename}
            sx={{
              aspectRatio: '4/3',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Overlay metadata */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            bgcolor: 'rgba(0,0,0,0.5)',
            color: '#FFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
          }}
        >
          {isVideo ? (
            <>
              <span>{formatDuration(media.duration)}</span>
              {media.width && media.height && (
                <span>
                  {media.width}×{media.height}
                </span>
              )}
            </>
          ) : (
            <span>{media.width && media.height ? `${media.width}×${media.height}` : ''}</span>
          )}
        </Box>
      </CardActionArea>
    </Card>
  )
}
