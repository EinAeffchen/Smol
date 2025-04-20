import React from 'react'
import { Link } from 'react-router-dom'
import { Person } from '../types'

export default function PersonCard({ person }: { person: Person }) {
  // use profile_face thumbnail if available, else fallback
  const src = person.profile_face
    ? `/thumbnails/${person.profile_face.thumbnail_path}`
    : '/logo.png'

  return (
    <Link to={`/person/${person.id}`} className="group block">
      <div className="flex flex-col items-center p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
        <img
          src={src}
          alt={person.name}
          className="w-20 h-20 rounded-full object-cover border-2 border-accent"
        />
        <h4 className="mt-2 text-base font-medium text-center">
          {person.name || 'Unknown'}
        </h4>
      </div>
    </Link>
  )
}
