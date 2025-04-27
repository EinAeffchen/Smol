import React, { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import PersonCard from '../components/PersonCard'
import TagCard from '../components/TagCard'
import { useInfinite } from '../hooks/useInfinite'
import { Media, Person, SearchResult, Tag } from '../types'

const API = import.meta.env.VITE_API_BASE_URL

export default function SearchPage() {
    const [searchParams] = useSearchParams()
    const q = searchParams.get('query') || ''
    const fetchSearch = useCallback(
        (skip: number, limit: number): Promise<SearchResult[]> => {
            return fetch(
                `${API}/search/?query=${encodeURIComponent(q)}&skip=${skip}&limit=${limit}`
            ).then(res => {
                if (!res.ok) throw new Error(res.statusText)
                return res.json() as Promise<SearchResult>
            }).then(page => [page])
        },
        [API, q]   // re-create whenever the query changes
    )
    const { items: pages, hasMore, loading, loaderRef } =
        useInfinite<SearchResult>(fetchSearch, 20, [q])
    const mediaList = pages.reduce<Media[]>((acc, page) => acc.concat(page.media), [])
    const peopleList = pages.reduce<Person[]>((acc, page) => acc.concat(page.persons), [])
    const tagList = pages.reduce<Tag[]>((acc, page) => acc.concat(page.tags), [])
    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            <h2 className="text-2xl font-semibold mb-6">Images/Videos</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {mediaList.map(m => <MediaCard key={m.id} media={m} />)}
            </div>
            <h2 className="text-2xl font-semibold mb-6">People</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {peopleList.map(p => <PersonCard key={p.id} person={p} />)}
            </div>
            <h2 className="text-2xl font-semibold mb-6">Tags</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                {tagList.map(t => <TagCard key={t.id} tag={t} />)}
            </div>
            {loading && (
                <div className="py-4 text-center text-gray-500">
                    Loading…
                </div>
            )}
            {!loading && hasMore && (
                <div
                    ref={loaderRef}
                    className="py-4 text-center text-gray-500"
                >
                    Scroll to load more…
                </div>
            )}
        </div>
    )
}
