import React from 'react'
import { Person } from '../types'

export default function PersonCard({ person }: { person: Person }) {
  return (
    <div className="flex flex-col items-center p-2 bg-gray-800 rounded-lg">
      <img
        src={person.faceUrl || '/default-avatar.png'}
        alt={person.name}
        className="w-20 h-20 rounded-full object-cover border-2 border-accent"
      />
      <h4 className="mt-2 text-base font-medium">{person.name || 'Unknown'}</h4>
      <div className="text-sm text-gray-300">
        {person.ethnicity} · {person.gender} · {person.age} yrs
      </div>
    </div>
  )
}
