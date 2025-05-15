// src/components/TagCard.tsx
import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Card, CardActionArea, CardContent, Typography, Box, AvatarGroup, Avatar } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import PersonIcon from '@mui/icons-material/Person'
import { Tag } from '../types'

const BG_CARD = '#2C2C2E'
const ACCENT = '#FF2E88'
const TEXT_SECONDARY = '#BFA2DB'
const AVATAR_SIZE = 36
const CARD_HEIGHT = 180

export default function TagCard({ tag }: { tag: Tag }) {
    const API = import.meta.env.VITE_API_BASE_URL ?? ''
    const countMedia = tag.media.length
    const countPeople = tag.persons.length

    return (
        <Card
            elevation={3}
            sx={{
                bgcolor: BG_CARD,
                borderRadius: 2,
                overflow: 'hidden',
                height: CARD_HEIGHT,
            }}
        >
            <CardActionArea
                component={RouterLink}
                to={`/tag/${tag.id}`}
                sx={{ height: '100%' }}
            >
                <CardContent
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        p: 2,
                    }}
                >
                    {/* Tag Name and Counts */}
                    <Box>
                        <Typography
                            variant="h6"
                            sx={{
                                color: '#FFF',
                                mb: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {tag.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <MovieIcon fontSize="small" sx={{ color: ACCENT, mr: 0.5 }} />
                            <Typography variant="body2" sx={{ color: TEXT_SECONDARY, mr: 2 }}>
                                {countMedia}
                            </Typography>
                            <PersonIcon fontSize="small" sx={{ color: ACCENT, mr: 0.5 }} />
                            <Typography variant="body2" sx={{ color: TEXT_SECONDARY }}>
                                {countPeople}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Thumbnails */}
                    <AvatarGroup
                        max={4}
                        sx={{
                            '& .MuiAvatar-root': {
                                width: AVATAR_SIZE,
                                height: AVATAR_SIZE,
                                borderRadius: 1,
                            },
                        }}
                    >
                        {tag.media.slice(0, 4).map(m => (
                            <Avatar
                                key={`m-${m.id}`}
                                src={`${API}/thumbnails/${m.id}.jpg`}
                                variant="rounded"
                            />
                        ))}
                        {tag.persons.slice(0, 4).map(p => p.profile_face?.thumbnail_path && (
                            <Avatar
                                key={`p-${p.id}`}
                                src={`${API}/thumbnails/${p.profile_face.thumbnail_path}`}
                                variant="rounded"
                            />
                        ))}
                    </AvatarGroup>
                </CardContent>
            </CardActionArea>
        </Card>
    )
}
