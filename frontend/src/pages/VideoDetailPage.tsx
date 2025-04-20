import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PersonCard from '../components/PersonCard'
import { Media, Person, Tag, Face } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [media, setMedia] = useState<Media | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${API}/media/${id}`)
      .then(res => res.json())
      .then((m: Media) => setMedia(m))
      .catch(console.error)
  }, [id])

  if (!media) return <div className="p-4">Loading…</div>

  // Handler: delete file
  async function handleDeleteFile() {
    if (!window.confirm(
      '⚠️ This will permanently delete the file and its thumbnail from disk. Continue?'
    )) return
    const res = await fetch(`${API}/media/${media.id}/file`, {
      method: 'DELETE'
    })
    if (res.ok) {
      alert('File deleted.')
      // reload metadata so thumbnail vanishes
      setMedia({ ...media, path: '', width: 0, height: 0 })
    } else {
      alert('Failed to delete file.')
    }
  }

  // Handler: delete record
  async function handleDeleteRecord() {
    if (!window.confirm(
      '⚠️ This will delete the database record (cannot be undone). Continue?'
    )) return
    const res = await fetch(`${API}/media/${media.id}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      alert('Record deleted. Returning home.')
      navigate('/')
    } else {
      alert('Failed to delete record.')
    }
  }

  return (
    <div className="bg-background text-text min-h-screen">
      <header className="flex items-center p-4 space-x-4">
        <Link to="/" className="text-accent hover:underline">← Back</Link>
        <h1 className="text-2xl font-semibold">{media.filename}</h1>
      </header>

      <div className="px-4 space-x-2">
        <button
          onClick={handleDeleteFile}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Delete File
        </button>
        <button
          onClick={handleDeleteRecord}
          className="px-3 py-1 bg-red-800 hover:bg-red-900 text-white rounded"
        >
          Delete Record
        </button>
      </div>

      <main className="p-4 space-y-8">
        {/* Video Player */}
        <video
          controls
          className="w-full max-h-[60vh] rounded-lg bg-black mx-auto"
          src={`/originals/${media.path}`}
        />

        {/* Persons Detected */}
        <section>
          <h2 className="text-xl font-semibold mb-2">Detected Persons</h2>
          <div className="flex flex-wrap gap-4">
            {(media.faces ?? []).map((face: Face) => (
              face.person
                ? <PersonCard key={face.id} person={face.person} />
                : <div key={face.id} className="p-4 bg-gray-800 rounded">Unassigned</div>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section>
          <h2 className="text-xl font-semibold mb-2">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {(media.tags ?? []).map((tag: Tag) => (
              <span
                key={tag.id}
                className="px-3 py-1 rounded-full bg-accent2 text-background text-sm"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </section>

        {/* Related (stub; implement via your /media?person_id=… or /media?tags=…) */}
        <section>
          <h2 className="text-xl font-semibold mb-2">Related Videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* TODO: fetch & map related videos */}
          </div>
        </section>
      </main>
    </div>
  )
}
