import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Media } from '../types'

function formatDuration(d?: number): string {
  if (!d) return ''
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

  return (
    <Link
      to={`/video/${media.id}`}
      className="group block rounded-xl overflow-hidden shadow-lg relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isVideo ? (
        // ─── Video Card ───────────────────────────
        <div className="relative w-full h-48 bg-gray-800">
          {/* static thumbnail until hover */}
          <img
            src={thumbUrl}
            alt={media.filename}
            className={`object-cover w-full h-full transition-opacity
              ${hovered ? 'opacity-0' : 'opacity-100'}`}
          />
          {/* on-hover video preview */}
          <video
            src={mediaUrl}
            muted
            loop
            playsInline
            className={`object-cover w-full h-full transition-opacity
              ${hovered ? 'opacity-100' : 'opacity-0'}`}
            onMouseEnter={e => e.currentTarget.play()}
            onMouseLeave={e => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
        </div>
      ) : (
        // ─── Image Card ───────────────────────────
        <div className="relative w-full h-48 bg-gray-800 overflow-hidden">
          <img
            src={thumbUrl}
            alt={media.filename}
            className="object-cover w-full h-full transition-transform
              group-hover:scale-110"
          />
        </div>
      )}

      {/* ─── Metadata Overlay ───────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-between text-sm text-text">
        {isVideo
          ? <span>{formatDuration(media.duration)}</span>
          : <span className="italic">Photo</span>
        }
        {isVideo && media.width && media.height && (
          <span>{media.width}×{media.height}</span>
        )}
      </div>
    </Link>
  )
}
