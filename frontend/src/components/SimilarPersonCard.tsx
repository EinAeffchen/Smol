import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, useTheme } from '@mui/material';
import { SimilarPerson } from '../types';
import { API } from '../config';

const getInitials = (name = '') => {
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function SimilarPersonCard({ id, name, similarity, thumbnail }: SimilarPerson) {
  const theme = useTheme();

  const thumbUrl = thumbnail
    ? `${API}/thumbnails/${encodeURIComponent(thumbnail)}`
    : undefined;

  return (
    <Box
      component={RouterLink}
      to={`/person/${id}`}
      sx={{
        aspectRatio: '3/4',
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        borderRadius: 3,
        textDecoration: 'none',
        color: 'white',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        background: thumbUrl
          ? `url(${thumbUrl})`
          : 'linear-gradient(135deg, #5F4B8B, #4A3A6A)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',

        '&:hover': {
          transform: 'scale(1.05)',
          boxShadow: theme.shadows[10],
          zIndex: 10,
        },
      }}
    >
      {!thumbUrl && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="h4" fontWeight="bold">
            {getInitials(name || 'Unknown')}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 50%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          p: 1.5,
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>
          {name || 'Unknown'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
          {similarity != null ? `${similarity.toFixed(1)}% match` : ''}
        </Typography>
      </Box>
    </Box>
  );
}