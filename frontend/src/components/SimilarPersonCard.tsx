import { Link } from 'react-router-dom'
import { Card, CardActionArea, CardContent, Avatar, Typography, Box } from '@mui/material'
import { SimilarPerson } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function SimilarPersonCard({ id, name, similarity, thumbnail }: SimilarPerson) {
  return (
    <Card sx={{ bgcolor: '#2C2C2E', color: '#FFF' }}>
      <CardActionArea
        component={Link}
        to={`/person/${id}`}
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}
      >
        {thumbnail ? (
          <Avatar
            src={`/thumbnails/${thumbnail}`}
            sx={{ width: 64, height: 64, mb: 1, border: '2px solid #FF2E88' }}
          />
        ) : (
          <Avatar sx={{ width: 64, height: 64, mb: 1, bgcolor: '#555' }} />
        )}

        <CardContent sx={{ textAlign: 'center', p: 0 }}>
          <Typography variant="body1" noWrap>{name || 'Unknown'}</Typography>
          <Typography variant="caption" color="#BFA2DB">
            {(similarity).toFixed(1)}% match
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}