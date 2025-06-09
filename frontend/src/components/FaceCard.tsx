import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
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
import { API, READ_ONLY } from '../config'

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
    const cardRef = useRef<HTMLDivElement>(null); // Ref to the Card element for positioning
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
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

    useEffect(() => {
        if (mode !== 'none' && cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY, // Position below the card
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        } else {
            setDropdownPosition(null);
        }
    }, [mode]); // Recalculate when mode changes or cardRef is available

    // Extracted Dropdown Content
    const renderDropdownContent = () => {
        if (!dropdownPosition) return null;

        const commonBoxSx = {
            position: 'absolute' as 'absolute', // Ensure TS knows it's a valid CSS position
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            bgcolor: '#2C2C2E', // Or your theme background
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            borderRadius: 1,
            p: 1,
            zIndex: (theme: any) => theme.zIndex.modal + 1, // Ensure it's above other content
            color: '#FFF', // Ensure text is visible
        };

        if (mode === 'search') {
            return (
                <Box sx={commonBoxSx}>
                    <TextField
                        size="small"
                        fullWidth
                        autoFocus // Good for usability
                        placeholder="Search…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        sx={{ mb: 1, input: { color: '#FFF' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(255,255,255,0.23)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' }, '&.Mui-focused fieldset': { borderColor: (theme: any) => theme.palette.primary.main } } }}
                    />
                    <Box sx={{ maxHeight: 150, overflowY: 'auto' }}> {/* Increased maxHeight */}
                        {/* ... cands mapping ... */}
                        {cands.length > 0 ? (
                            cands.map(p => (
                                <Box
                                    key={p.id}
                                    onClick={() => assignTo(p.id)}
                                    sx={{
                                        px: 1, py: 0.5, display: 'flex', alignItems: 'center',
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
            );
        }

        if (mode === 'new') {
            return (
                <Box sx={commonBoxSx}>
                    {['name', 'age', 'gender'].map(field => (
                        <TextField
                            key={field}
                            name={field}
                            placeholder={field.charAt(0).toUpperCase() + field.slice(1)} // Capitalize placeholder
                            size="small"
                            fullWidth
                            autoFocus={field === 'name'} // Autofocus the first field
                            value={(form as any)[field]}
                            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                            sx={{ mb: 1, input: { color: '#FFF' }, '& .MuiOutlinedInput-root': { fieldset: { borderColor: 'rgba(255,255,255,0.23)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' }, '&.Mui-focused fieldset': { borderColor: (theme: any) => theme.palette.primary.main } } }}
                        />
                    ))}
                    <Button /* ... create & assign button ... */
                        size="small" fullWidth onClick={createAssign} variant="contained"
                        disabled={creating} sx={{ bgcolor: '#FF2E88', mt: 1, '&:hover': { bgcolor: '#E02070' } }}
                    >
                        {creating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Create & Assign'}
                    </Button>
                </Box>
            );
        }
        return null;
    };

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
        <> {/* Use React.Fragment to allow Portal as a sibling potentially */}
            <Card
                ref={cardRef} // Assign ref to the Card
                sx={{
                    width: 130,
                    bgcolor: '#2C2C2E',
                    color: '#FFF',
                    position: 'relative',
                    // zIndex for sibling card stacking is okay, but won't help with overflow:hidden parent
                    zIndex: mode !== 'none' ? (theme) => theme.zIndex.tooltip : 'auto',
                    '&:hover .hover-actions': { opacity: 1 },
                }}
            >
                {/* ... CardActionArea and hover actions ... */}
                <Box sx={{ position: 'relative' }}>
                    <CardActionArea component={Link} to={`/media/${face.media_id}`}>
                        <Avatar
                            src={`/thumbnails/${face.thumbnail_path}`}
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

                {!READ_ONLY && (
                    <CardContent sx={{ px: 1, py: 1, textAlign: 'center' /* Center content */ }}>
                        {face.person ? (
                            <Typography variant="caption" color="#BFA2DB" display="block">
                                Assigned
                            </Typography>
                        ) : (
                            <Stack direction="row" spacing={1} justifyContent="center">
                                {/* ... Assign Existing and Create New Person IconButtons ... */}
                                <Tooltip title="Assign Existing">
                                    <IconButton size="small" onClick={() => setMode(prev => prev === 'search' ? 'none' : 'search')}>
                                        <PersonSearchIcon fontSize="small" sx={{ color: mode === 'search' ? '#FF2E88' : 'white' }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Create New Person">
                                    <IconButton size="small" onClick={() => setMode(prev => prev === 'new' ? 'none' : 'new')}>
                                        <PersonAddIcon fontSize="small" sx={{ color: mode === 'new' ? '#FF2E88' : 'white' }} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        )}
                    </CardContent>
                )}

                {/* The Collapse sections are now removed from here */}
            </Card>

            {/* Render the dropdown content via a Portal */}
            {mode !== 'none' && dropdownPosition && ReactDOM.createPortal(
                renderDropdownContent(),
                document.body // Or a dedicated portal root element
            )}
        </>
    );
}