// frontend/src/components/Header.tsx
import React, { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import ControlPanelModal from './ControlPanelModal'

export function Header() {
  const [openPanel, setOpenPanel] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    // if empty, do nothing
    if (!q.trim()) return
    // navigate to your SearchPage with ?query=...
    navigate(`/searchresults?query=${encodeURIComponent(q.trim())}`)
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
          <form
            onSubmit={onSearchSubmit}
            className="flex flex-1"
            role="search"
          >
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search tags, people, duration…"
              className="
                flex-1
                bg-gray-800 placeholder-gray-500 text-text
                rounded-full px-4 py-2
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
              to="/map"
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'hover:text-accent'
              }
            >
              Map
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
