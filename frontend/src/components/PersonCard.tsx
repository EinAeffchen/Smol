// src/components/PersonCard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Person } from '../types'

export default function PersonCard({ person }: { person: Person }) {
  const API = import.meta.env.VITE_API_BASE_URL;

  const src = person.profile_face
    ? `${API}/thumbnails/${person.profile_face.thumbnail_path}`
    : `${API}/logo.png`
  return (
    <Link to={`/person/${person.id}`} className="group block h-full">
      <div className="flex flex-col items-center p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-md hover:shadow-lg transition-shadow h-full">
        {/* Avatar */}
        <div className="w-28 h-28 mb-3">
          <img
            src={src}
            alt={person.name ?? 'Unknown'}
            className="w-full h-full rounded-full object-cover"
          />
        </div>

        {/* Name */}
        <h4 className="text-lg font-semibold text-center text-text">
          {person.name || 'Unknown'}
        </h4>

        {/* Age */}
        <div className="mt-2 text-sm text-gray-400 text-center space-y-1">
          {person.age != null && <div>{person.age} yr{person.age !== 1 ? 's' : ''}</div>}
        </div>
      </div>
    </Link>
  )
}
