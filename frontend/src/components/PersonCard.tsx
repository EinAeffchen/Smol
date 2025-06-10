import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Card,
  CardActionArea,
  Avatar,
  Typography,
} from '@mui/material'
import { API } from '../config'
import { Person } from '../types'

const ACCENT = '#FF2E88'
const BG_CARD = '#2C2C2E'
const TEXT_SECONDARY = '#BFA2DB'

export default function PersonCard({ person }: { person: Person }) {
  const thumb =
    person.profile_face?.thumbnail_path
      ? `${API}/thumbnails/${person.profile_face.thumbnail_path}`
      : undefined

  return (
    <Card
      elevation={3}
      sx={{
        bgcolor: BG_CARD,
        borderRadius: 2,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={`/person/${person.id}`}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          height: '100%',
          textAlign: 'center',
        }}
      >
        <Avatar
          src={thumb}
          sx={{ width: 100, height: 100, mb: 1, border: `2px solid ${ACCENT}` }}
        />
        <Typography
          variant="subtitle1"
          noWrap
          sx={{ color: '#FFF', mb: 0.5, width: '100%' }}
        >
          {person.name || 'Unknown'}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: TEXT_SECONDARY, mt: 0.5, minHeight: '1em' }}
        >
          {person.age != null ? `${person.age} yr${person.age !== 1 ? 's' : ''}` : ''}
        </Typography>
      </CardActionArea>
    </Card>
  )
}
