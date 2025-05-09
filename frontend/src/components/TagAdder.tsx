import React, { useState, useEffect } from 'react'
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

    // load all tags for suggestion / lookup
    useEffect(() => {
        fetch(`${API}/tags/`)
            .then(r => {
                if (!r.ok) throw new Error(`Status ${r.status}`)
                return r.json() as Promise<CursorResponse<Tag>>
            })
            .then(page => {
                setAllTags(page.items)    // ← pull the array out
            })
            .catch(console.error)
    }, [API])

    async function handleAdd() {
        const name = inputValue.trim()
        if (!name) return

        // don't add if already there
        if (existingTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setInputValue('')
            return
        }

        // find or create the tag
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

        // assign to owner
        const res2 = await fetch(
            `${API}/tags/${ownerType}/${ownerId}/${tag.id}`,
            { method: 'POST' }
        )
        if (!res2.ok) {
            console.error('Failed to assign tag', await res2.text())
            return
        }

        onTagAdded(tag)
        setInputValue('')
    }

    return (
        <div className="flex items-center space-x-2 mb-4">
            <input
                type="text"
                placeholder="Add tag…"
                className="
          flex-grow
          px-3 py-1
          bg-gray-800 placeholder-gray-400 text-text
          rounded focus:outline-none focus:ring-2 focus:ring-accent
        "
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAdd()
                    }
                }}
            />
            <button
                onClick={handleAdd}
                className="px-3 py-1 bg-accent hover:bg-accent2 text-background rounded"
            >
                Add
            </button>
        </div>
    )
}
