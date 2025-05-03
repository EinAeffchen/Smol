// src/components/MediaCard.tsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Media } from '../types'

function formatDuration(d?: number): string {
  if (d == null) return ''
  const m = Math.floor(d / 60)
  const s = Math.round(d % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function MediaCard({ media }: { media: Media }) {
  const isVideo = typeof media.duration === 'number'
  const mediaUrl = `/originals/${media.path}`
  const thumbUrl = `/thumbnails/${media.id}.jpg`
  const [hovered, setHovered] = useState(false)

  // decide aspect class
  const aspectClass = isVideo ? 'aspect-video' : 'aspect-[4/3]'

  return (
    <Link
      to={isVideo ? `/video/${media.id}` : `/image/${media.id}`}
      className="group block rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`${aspectClass} w-full bg-gray-800 relative`}>
        {isVideo ? (
          hovered ? (
            <video
              src={mediaUrl}
              autoPlay muted loop playsInline
              className="object-cover w-full h-full"
            />
          ) : (
            <img
              src={thumbUrl}
              alt={media.filename}
              className="object-cover w-full h-full"
            />
          )
        ) : (
          <img
            src={thumbUrl}
            alt={media.filename}
            className="object-cover w-full h-full"
          />
        )}
      </div>

      {isVideo && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {formatDuration(media.duration)}
        </div>
      )}
    </Link>
  )
}
