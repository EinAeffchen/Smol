import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Media } from '../types'

function formatDuration(d?: number): string {
  if (d == null) return ''
  const m = Math.floor(d / 60)
  const s = Math.round(d % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

export default function MediaCard({ media }: { media: Media }) {
  const isVideo = typeof media.duration === 'number'
  const mediaUrl = `/originals/${media.path}`
  const thumbUrl = `/thumbnails/${media.id}.jpg`
  const [hovered, setHovered] = useState(false)

  // link to /video/:id for videos, /image/:id for photos
  const linkTo = isVideo ? `/video/${media.id}` : `/image/${media.id}`

  return (
    <Link
      to={linkTo}
      className="group block rounded-xl overflow-hidden shadow-lg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative w-full h-48 bg-gray-800">
        {isVideo ? (
          hovered ? (
            <video
              src={mediaUrl}
              autoPlay
              muted
              loop
              playsInline
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
            className={`object-cover w-full h-full transition-transform 
               ${hovered ? 'scale-110' : ''}`}
          />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-between text-sm text-text">
        {isVideo ? (
          <span>{formatDuration(media.duration)}</span>
        ) : (
          <span className="italic">Photo</span>
        )}
        {isVideo && media.width && media.height && (
          <span>{media.width}×{media.height}</span>
        )}
      </div>
    </Link>
  )
}
