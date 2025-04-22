// frontend/src/components/SimilarPersonCard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Person } from '../types'
import PersonCard from './PersonCard'
import { SimilarPerson } from '../types'


export default function SimilarPersonCard({
  id,
  name,
  similarity,
  thumbnail,
}: SimilarPerson) {
  return (
    <Link
      to={`/person/${id}`}
      className="
        group block text-center p-2
        bg-gray-800 rounded-lg shadow hover:shadow-md
      "
    >
      {/* Thumbnail or fallback */}
      {thumbnail ? (
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden mb-2">
          <img
            src={`/thumbnails/${thumbnail}`}
            alt={name || 'Profile'}
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className="w-20 h-20 mx-auto rounded-full bg-gray-700 mb-2" />
      )}

      {/* Name */}
      <div className="text-sm font-medium truncate">{name}</div>

      {/* Score */}
      <div className="text-xs text-gray-400 mt-1">
        {(similarity * 100).toFixed(1)}%
      </div>
    </Link>
  )
}
