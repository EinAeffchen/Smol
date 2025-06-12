import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardActionArea, CardMedia, Box, Typography, useTheme } from '@mui/material';
import { Media } from '../types';
import { API } from '../config';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';


function formatDuration(d?: number): string {
  if (d == null) return '';
  const m = Math.floor(d / 60);
  const s = Math.round(d % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MediaCard({ media }: { media: Media }) {
  const theme = useTheme();
  const isVideo = typeof media.duration === 'number';
  const mediaUrl = `${API}/originals/${media.path}`;
  const thumbUrl = `${API}/thumbnails/${media.id}.jpg`;

  const [hovered, setHovered] = useState(false);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: theme.shadows[10],
          zIndex: 10,
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={`/medium/${media.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <CardMedia
          component={isVideo && hovered ? 'video' : 'img'}
          src={isVideo && hovered ? mediaUrl : thumbUrl}
          image={isVideo && hovered ? undefined : thumbUrl}
          alt={media.filename}
          autoPlay={isVideo && hovered}
          muted loop playsInline
          sx={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />

        {isVideo && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              opacity: 0.8,
              pointerEvents: 'none',
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            <PlayArrowIcon sx={{ fontSize: '3rem' }} />
          </Box>
        )}


        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)',
            '& > div': {
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
            }
          }}
        >
          <Box sx={{
            display: 'flex',
            justifyContent: 'flex-end', 
            flexDirection: 'column',
            height: '100%',
          }}>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, color: 'white' }}>
              {isVideo ? (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PlayCircleOutlineIcon sx={{ fontSize: '1rem' }} />
                  <Typography variant="caption" lineHeight={1}>{formatDuration(media.duration)}</Typography>
                </Box>
              ) : <div />}
              <Typography variant="caption" lineHeight={1}>
                {media.width && media.height ? `${media.width}×${media.height}` : ''}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}