// frontend/src/pages/SearchResultsPage.tsx
import React, { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'
import TagCard from '../components/TagCard'
import { SearchResult } from '../types'
import { useInfinite, CursorResponse } from '../hooks/useInfinite'

const API = import.meta.env.VITE_API_BASE_URL
const ITEMS_PER_PAGE = 20


export default function SearchResultsPage() {
    const [searchParams] = useSearchParams()
    const category = (searchParams.get('category') as 'media' | 'person' | 'tag') || 'media'
    const query = searchParams.get('query') || ''
    const fetchPage = useCallback(
        (cursor: string | null, limit: number) => {
            const params = new URLSearchParams({ category, query })
            params.set('limit', String(limit))
            if (cursor) params.set('cursor', cursor)
            return fetch(`${API}/search/?${params}`)
                .then(r => r.json() as Promise<CursorResponse<SearchResult>>)
        },
        [API, category, query],
    )
    const {
        items: pages,
        hasMore,
        loading,
        loaderRef,
    } = useInfinite<SearchResult>(fetchPage, ITEMS_PER_PAGE, [category, query])

    const mediaList = useMemo(() => pages.flatMap(p => p.media), [pages])
    const peopleList = useMemo(() => pages.flatMap(p => p.persons), [pages])
    const tagList = useMemo(() => pages.flatMap(p => p.tags), [pages])

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            {/* Title */}
            <h1 className="text-2xl font-semibold mb-6 capitalize">
                {category === 'media'
                    ? 'Media Results'
                    : category === 'person'
                        ? 'People Results'
                        : 'Tag Results'}
            </h1>

            {/* Grid */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
                {category === 'media' &&
                    mediaList.map(m => <MediaCard key={m.id} media={m} />)}
                {category === 'person' &&
                    peopleList.map(p => <PersonCard key={p.id} person={p} />)}
                {category === 'tag' &&
                    tagList.map(t => <TagCard key={t.id} tag={t} />)}
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
        </div>
    )
}
