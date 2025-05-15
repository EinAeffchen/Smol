// src/components/TagAdder.tsx
import React, { useState, useEffect } from 'react'
import { Box, TextField, Button } from '@mui/material'
import { Tag } from '../types'
import { CursorResponse } from '../hooks/useInfinite'

type OwnerType = 'media' | 'persons'

interface TagAdderProps {
    ownerType: OwnerType
    ownerId: number
    existingTags: Tag[]
    onTagAdded: (tag: Tag) => void
}

export default function TagAdder({
    ownerType,
    ownerId,
    existingTags,
    onTagAdded,
}: TagAdderProps) {
    const [inputValue, setInputValue] = useState('')
    const [allTags, setAllTags] = useState<Tag[]>([])
    const API = import.meta.env.VITE_API_BASE_URL ?? ''

    useEffect(() => {
        fetch(`${API}/tags/`)
            .then(r => r.json())
            .then((page: CursorResponse<Tag>) => setAllTags(page.items))
            .catch(console.error)
    }, [API])

    async function handleAdd() {
        const name = inputValue.trim()
        if (!name) return

        if (existingTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setInputValue('')
            return
        }

        let tag = allTags.find(t => t.name.toLowerCase() === name.toLowerCase())
        if (!tag) {
            const res = await fetch(`${API}/tags/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            if (!res.ok) {
                console.error('Failed to create tag', await res.text())
                return
            }
            tag = await res.json()
            setAllTags(prev => [...prev, tag])
        }

        const res2 = await fetch(`${API}/tags/${ownerType}/${ownerId}/${tag.id}`, { method: 'POST' })
        if (!res2.ok) {
            console.error('Failed to assign tag', await res2.text())
            return
        }

        onTagAdded(tag)
        setInputValue('')
    }

    return (
        <Box display="flex" gap={2} alignItems="center">
            <TextField
                variant="outlined"
                size="small"
                placeholder="Add tag…"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAdd()
                    }
                }}
                sx={{ flexGrow: 1 }}
            />
            <Button variant="contained" color="secondary" onClick={handleAdd}>
                Add
            </Button>
        </Box>
    )
}
