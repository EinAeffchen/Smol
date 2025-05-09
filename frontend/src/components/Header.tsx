// frontend/src/components/Header.tsx
import React, { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import ControlPanelModal from './ControlPanelModal'

export function Header() {
  const [openPanel, setOpenPanel] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<'media' | 'person' | 'tag'>('media')
  const navigate = useNavigate()

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return

    // include both category and query in the URL
    navigate(
      `/searchresults?` +
      new URLSearchParams({
        category,
        query: trimmed,
      }).toString()
    )
  }


  return (
    <>
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-screen-xl mx-auto flex items-center space-x-4 px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex-none">
            <img
              src="/static/logo.png"
              alt="SMOL logo"
              className="h-12 w-auto"
            />
          </Link>

          {/* Search bar */}
          <form onSubmit={onSearchSubmit} className="flex flex-1" role="search">
            {/* Dropdown */}
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="
                bg-gray-800 text-text
                rounded-l-full border border-r-0 border-gray-700
                px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-accent
                transition
              "
            >
              <option value="media">Media</option>
              <option value="person">People</option>
              <option value="tag">Tags</option>
            </select>

            {/* Text input */}
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search…"
              className="
                flex-1
                bg-gray-800 placeholder-gray-500 text-text
                rounded-r-full px-4 py-2
                focus:outline-none focus:ring-2 focus:ring-accent
                transition
              "
            />
          </form>

          {/* Desktop nav (hidden on small) */}
          <nav className="hidden md:flex flex-none items-center space-x-6">
            <NavLink
              to="/images"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Images
            </NavLink>
            <NavLink
              to="/videos"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Videos
            </NavLink>
            <NavLink
              to="/tags"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Tags
            </NavLink>
            <NavLink
              to="/people"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              People
            </NavLink>
            <NavLink
              to="/orphanfaces"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Unassigned Faces
            </NavLink>
            <NavLink
              to="/map"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Map
            </NavLink>
            <NavLink
              to="/maptagger"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Geotagger
            </NavLink>
          </nav>

          {/* Menu button (visible on small only) */}
          <button
            onClick={() => setOpenPanel(true)}
            className="
              flex-none flex items-center space-x-1
              text-text hover:text-accent
              focus:outline-none focus:ring-2 focus:ring-accent
              px-3 py-1
            "
          >
            <svg
              className="h-6 w-6"
              fill="none" stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {openPanel && <ControlPanelModal onClose={() => setOpenPanel(false)} />}
    </>
  )
}
