// src/pages/TagsPage.tsx
import React from 'react'
import TagCard from '../components/TagCard'
import { useInfinite } from '../hooks/useInfinite'
import { Tag } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function TagsPage() {
  const fetchTags = (skip: number, limit: number) =>
    fetch(`${API}/tags?skip=${skip}&limit=${limit}`)
      .then(r => r.json() as Promise<Tag[]>)

  const { items: tags, hasMore, loader } = useInfinite<Tag>(fetchTags, 30)

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Tags</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
        {tags.map(tag => <TagCard key={tag.id} tag={tag} />)}
      </div>
      {hasMore && (
        <div ref={loader} className="py-8 text-center text-gray-500">
          Loading more tags…
        </div>
      )}
    </div>
  )
}
