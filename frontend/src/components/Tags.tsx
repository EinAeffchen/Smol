import React from 'react'
import { Link } from 'react-router-dom'
import { Media, Tag } from '../types'

const API = import.meta.env.VITE_API_BASE_URL ?? ''

export interface TagsProps {
    media: Media
    onUpdate: (updated: Media) => void
}

export function Tags({ media, onUpdate }: Readonly<TagsProps>) {
    const handleRemove = async (tag: Tag) => {
        await fetch(`${API}/tags/media/${media.id}/${tag.id}`, { method: 'DELETE' })
        onUpdate({
            ...media,
            tags: media.tags.filter(t => t.id !== tag.id),
        })
    }

    return (
        <section>
            <h2 className="text-xl font-semibold mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
                {(media.tags ?? []).map(tag => (
                    <div
                        key={tag.id}
                        className="flex items-center bg-accent2 text-background px-3 py-1 rounded-full space-x-1"
                    >
                        <Link to={`/tag/${tag.id}`}>{tag.name}</Link>
                        <button
                            onClick={() => handleRemove(tag)}
                            className="font-bold"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </section>
    )
}
