import React, { useState, useEffect, useCallback, Fragment } from 'react'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'
import { MediaIndex, PersonIndex } from '../types'
import { useInfinite } from '../hooks/useInfinite'

const API = import.meta.env.VITE_API_BASE_URL || ''
const ITEMS_PER_ROW = 6
const ROWS_BEFORE_PEOPLE = 3
const ITEMS_PER_PAGE = ITEMS_PER_ROW * ROWS_BEFORE_PEOPLE // 18

export default function IndexPage() {
  const [tags, setTags] = useState<string[]>([])
  const [people, setPeople] = useState<PersonIndex[]>([])
  const [sortOrder, setSortOrder] = useState<'newest' | 'popular'>('newest')

  const fetchPage = useCallback(
    async (skip: number, limit: number) => {
      const params = new URLSearchParams()
      params.set('skip', skip.toString())
      params.set('limit', limit.toString())
      params.set('sort', sortOrder)
      tags.forEach(tag => params.append('tags', tag))
      const res = await fetch(`${API}/media/?${params.toString()}`)
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      return Array.isArray(data) ? data as MediaIndex[] : []
    },
    [tags, sortOrder]
  )


  const { items: mediaItems, hasMore, loading, loaderRef } =
    useInfinite<MediaIndex>(fetchPage, ITEMS_PER_PAGE, [tags, sortOrder])

  useEffect(() => {
    fetch(`${API}/persons/`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setPeople(data))
      .catch(console.error)
  }, [])

  return (
    <div className="bg-background text-text min-h-screen">
      <main className="p-4 space-y-4">
        {/* Order Switch */}
        <div className="flex justify-center mb-6">
          <label
            htmlFor="order-toggle"
            className="inline-flex items-center p-1 bg-gray-800 rounded-md shadow-inner cursor-pointer"
          >
            <input
              id="order-toggle"
              type="checkbox"
              className="hidden peer"
              checked={sortOrder === 'popular'}
              onChange={e => setSortOrder(e.target.checked ? 'popular' : 'newest')}
            />
            <span className="px-4 py-2 rounded-l-md bg-accent text-text peer-checked:bg-gray-700 peer-checked:text-gray-300">
              Newest
            </span>
            <span className="px-4 py-2 rounded-r-md bg-gray-700 text-gray-300 peer-checked:bg-accent peer-checked:text-text">
              Most Viewed
            </span>
          </label>
        </div>
        {/* Media + People grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {mediaItems.map((m, idx) => (
            <Fragment key={m.id}>
              <div className="transition-transform transform hover:shadow-lg hover:-translate-y-1">
                <MediaCard media={m} />
              </div>
            </Fragment>
          ))}
        </div>

        {/* Loading & sentinel */}
        {loading && (
          <div className="py-4 text-center text-gray-500">Loading more…</div>
        )}
        {!loading && hasMore && (
          <div ref={loaderRef} className="py-4 text-center text-gray-500">
            Scroll to load more…
          </div>
        )}
      </main>
    </div>
  )
}
