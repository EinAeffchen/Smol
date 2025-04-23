import React, { useState, useEffect, FormEvent } from 'react'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'

// Define the shapes you expect from the API
interface Media {
  id: number
  path: string
  filename: string
  size: number
  duration?: number
  width?: number
  height?: number
  views: number
  inserted_at: string  // ISO date
}

interface Person {
  id: number
  name?: string
  age?: number
  gender?: string
}

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function IndexPage() {
  // Controlled search input
  const [searchInput, setSearchInput] = useState('')
  // Tags array for filtering; useEffect will run whenever this changes
  const [tags, setTags] = useState<string[]>([])

  const [newest, setNewest] = useState<Media[]>([])
  const [popular, setPopular] = useState<Media[]>([])
  const [people, setPeople] = useState<Person[]>([])

  // Called whenever `tags` updates (including initially, when tags=[])
  useEffect(() => {
    async function fetchMedia() {
      try {
        // Build query string only if tags.length > 0
        const params = new URLSearchParams()
        if (tags.length > 0) {
          tags.forEach(tag => params.append('tags', tag))
        }
        const qs = params.toString() ? `?${params.toString()}` : ''
        const res = await fetch(`${API}/media/${qs}`)
        const data = await res.json()
        if (!Array.isArray(data)) {
          console.error('media API returned non-array:', data)
          return
        }

        // Sort by inserted_at for “Newest”
        const sortedByDate = [...data].sort((a, b) =>
          new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime()
        )
        setNewest(sortedByDate.slice(0, 30))

        // Sort by views for “Most Viewed”
        const sortedByViews = [...data].sort((a, b) =>
          b.views - a.views
        )
        setPopular(sortedByViews.slice(0, 30))
      } catch (err) {
        console.error('Error fetching media:', err)
      }
    }

    async function fetchPeople() {
      try {
        const res = await fetch(`${API}/persons/`)
        const data = await res.json()
        if (!Array.isArray(data)) return
        setPeople(data)
      } catch (err) {
        console.error('Error fetching persons:', err)
      }
    }

    fetchMedia()
    fetchPeople()
  }, [tags])

  // Handle form submit (either button or Enter key)
  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    // parse comma‑separated tags, trim, remove empties
    const parsed = searchInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    setTags(parsed)
  }

  return (
    <div className="bg-background text-text min-h-screen">
      <main className="p-4 space-y-12">
        {/* Newest Videos */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Newest Content</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {newest.map(m => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
        </section>

        {/* Most Viewed */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Most Viewed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {popular.map(m => (
              <MediaCard key={m.id} media={m} />
            ))}
          </div>
        </section>

        {/* People Carousel */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">People</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {people.map(p => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
