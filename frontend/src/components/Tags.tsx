import React from 'react'
import { Link } from 'react-router-dom'
import { Media, Tag } from '../types'
import { API } from '../config'
import { Person } from '../types'

export interface TagsProps {
    media?: Media
    person?: Person
    onUpdate: (updated: Media) => void
}

export function Tags({ media, person, onUpdate }: Readonly<TagsProps>) {
    const owner = media || person;
    const handleRemove = async (tag: Tag) => {
        await fetch(`${API}/api/tags/media/${owner.id}/${tag.id}`, { method: 'DELETE' })
        onUpdate({
            ...owner,
            tags: owner.tags.filter(t => t.id !== tag.id),
        })
    }
    return (
        <section>
            <h2 className="text-xl font-semibold mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
                {(owner.tags ?? []).map(tag => (
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
