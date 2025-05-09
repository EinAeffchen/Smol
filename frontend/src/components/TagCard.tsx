// src/components/TagCard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Tag } from '../types'

export default function TagCard({ tag }: { tag: Tag }) {
    const countMedia = tag.media.length
    const countPeople = tag.persons.length
    const API = import.meta.env.VITE_API_BASE_URL;


    // take up to 4 thumbnails from tag.media
    const thumbs = tag.media.slice(0, 4).map(m => (
        <img
            key={m.id}
            src={`${API}/thumbnails/${m.id}.jpg`}
            alt=""
            className="w-12 h-12 object-cover rounded"
        />
    ))
    const profiles = tag.persons.slice(0, 4).map(p => (
        <img
            key={p.id}
            src={`${API}/thumbnails/${p.profile_face?.thumbnail_path}`}
            alt=""
            className="w-12 h-12 object-cover rounded"
        />
    ))

    return (
        <Link
            to={`/tag/${tag.id}`}
            className="
        block bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition
      "
        >
            <h2 className="font-semibold mb-1">{tag.name}</h2>
            <div className="flex items-center text-sm text-gray-400 mb-2">
                <span className="mr-2">🎬 {countMedia}</span>
                <span>👤 {countPeople}</span>
            </div>
            <div className="flex -space-x-1">
                {thumbs}
                {profiles}
                {countMedia > 4 && (
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-700 rounded text-xs">
                        +{countMedia - 4}
                    </div>
                )}
            </div>
        </Link>
    )
}
