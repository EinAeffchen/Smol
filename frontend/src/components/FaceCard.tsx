import React, { useState, useEffect } from 'react'
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    CardActionArea,
    Collapse,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { Link } from 'react-router-dom'
import StarIcon from '@mui/icons-material/Star'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import { Face, Person } from '../types'
import { bool } from 'prop-types'
import CircularProgress from '@mui/material/CircularProgress'


const API = import.meta.env.VITE_API_BASE_URL ?? ''

export default function FaceCard({
    face,
    isProfile,
    onSetProfile,
    onAssign,
    onCreate,
    onDelete,
}: {
    face: Face
    isProfile: boolean
    onSetProfile: (faceId: number) => void
    onAssign: (personId: number) => void
    onCreate: (data: { name?: string; age?: number; gender?: string }) => void
    onDelete: () => void
}) {
    const [mode, setMode] = useState<'none' | 'search' | 'new'>('none')
    const overlayOpen = mode !== 'none'
    const [query, setQuery] = useState('')
    const [creating, setCreating] = useState(false)

    const [cands, setCands] = useState<Person[]>([])
    const [assigningId, setAssigningId] = useState<number | null>(null)

    const [form, setForm] = useState({ name: '', age: '', gender: '' })

    useEffect(() => {
        if (mode !== 'search' || !query.trim()) {
            setCands([])
            return
        }
        fetch(`${API}/persons/?name=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(r => setCands(r.items))
            .catch(console.error)
    }, [mode, query])

    async function assignTo(pid: number) {
        if (assigningId !== null) return

        setAssigningId(pid)
        try {
            await onAssign(pid)
        } finally {
            setAssigningId(null)
        }
    }

    async function createAssign() {
        if (creating) return
        setCreating(true)

        const payload: any = {}
        if (form.name) payload.name = form.name
        if (form.age) payload.age = Number(form.age)
        if (form.gender) payload.gender = form.gender

        try {
            await onCreate(payload)
        } finally {
            setCreating(false)
        }
    }


    return (
        <Card
            sx={{
                width: 130,
                bgcolor: '#2C2C2E',
                color: '#FFF',
                position: 'relative',
                overflow: 'visible',
                // bring this card above its siblings when the overlay is open:
                zIndex: overlayOpen ? (theme) => theme.zIndex.tooltip : 'auto',
                '&:hover .hover-actions': {
                    opacity: 1,
                },
            }}
        >
            <Box sx={{ position: 'relative' }}>
                <CardActionArea component={Link} to={`/media/${face.media_id}`}>
                    <Avatar
                        src={`${API}/thumbnails/${face.thumbnail_path}`}
                        variant="rounded"
                        sx={{ width: '100%', height: 124, borderRadius: 2, border: isProfile ? '3px solid #FF2E88' : 'none' }}
                    />
                </CardActionArea>
                <Box
                    className="hover-actions"
                    sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        right: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        opacity: 0,
                        transition: 'opacity 0.3s',
                    }}
                >
                    <Tooltip title="Delete">
                        <IconButton size="small" sx={{ bgcolor: 'rgba(0,0,0,0.4)' }} onClick={onDelete}>
                            <DeleteIcon fontSize="small" sx={{ color: 'red' }} />
                        </IconButton>
                    </Tooltip>
                    {!isProfile && (
                        <Tooltip title="Set as profile">
                            <IconButton size="small" sx={{ bgcolor: '#FF2E88' }} onClick={() => onSetProfile(face.id)}>
                                <StarIcon fontSize="small" sx={{ color: 'white' }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            <CardContent sx={{ px: 1, py: 1 }}>
                {face.person ? (
                    <Typography variant="caption" color="#BFA2DB" textAlign="center" display="block">
                        Assigned
                    </Typography>
                ) : (
                    <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Assign Existing">
                            <IconButton size="small" onClick={() => setMode(mode === 'search' ? 'none' : 'search')}>
                                <PersonSearchIcon fontSize="small" sx={{ color: 'white' }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Create New Person">
                            <IconButton size="small" onClick={() => setMode(mode === 'new' ? 'none' : 'new')}>
                                <PersonAddIcon fontSize="small" sx={{ color: 'white' }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                )}
            </CardContent>

            <Collapse in={mode === 'search'}>
                <Box px={1} pb={1}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        sx={{ mb: 1, input: { color: '#FFF' } }}
                    />
                    <Box sx={{ maxHeight: 96, overflowY: 'auto' }}>
                        {cands.length > 0 ? (
                            cands.map(p => (
                                <Box
                                    key={p.id}
                                    onClick={() => assignTo(p.id)}
                                    sx={{
                                        px: 1,
                                        py: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: assigningId ? 'not-allowed' : 'pointer',
                                        opacity: assigningId && assigningId !== p.id ? 0.5 : 1,
                                        '&:hover': { bgcolor: assigningId ? 'inherit' : '#444' },
                                    }}
                                >
                                    {p.name || 'Unknown'}
                                    {assigningId === p.id && (
                                        <CircularProgress size={14} sx={{ ml: 1 }} />
                                    )}
                                </Box>
                            ))
                        ) : (
                            <Typography variant="caption" color="gray">
                                {query.trim() ? 'No matches' : 'Type to search'}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Collapse>

            <Collapse in={mode === 'new'} >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        width: '100%',
                        bgcolor: '#2C2C2E',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        borderRadius: 1,
                        p: 1,
                        zIndex: 1,  // child only needs to be >= 0 now
                    }}
                >
                    {['name', 'age', 'gender'].map(field => (
                        <TextField
                            key={field}
                            name={field}
                            placeholder={field}
                            size="small"
                            fullWidth
                            value={(form as any)[field]}
                            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                            sx={{ mb: 1, input: { color: '#FFF' } }}
                        />
                    ))}
                    <Button
                        size="small"
                        fullWidth
                        onClick={createAssign}
                        variant="contained"
                        disabled={creating}
                        sx={{ bgcolor: '#FF2E88', mt: 1 }}
                    >
                        {creating ? (
                            <CircularProgress size={18} sx={{ color: 'white' }} />
                        ) : (
                            'Create & Assign'
                        )}
                    </Button>


                </Box>
            </Collapse>
        </Card >
    )
}