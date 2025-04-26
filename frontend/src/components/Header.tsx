// frontend/src/components/Header.tsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import ControlPanelModal from './ControlPanelModal'

export function Header() {
  const [openPanel, setOpenPanel] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-gray-800 flex items-center">

        {/* LOGO ONLY */}
        <div className="flex-none ml-6">
          <Link to="/">
            <img
              src="/static/logo.png"
              alt="SMOL logo"
              className="h-16 w-auto"   /* bigger logo */
            />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-evenly px-6 py-3">
          <form className="flex-2 max-w-xl" role="search" onSubmit={e => e.preventDefault()}>
            <input
              type="text"
              placeholder="Search by tag, person, duration…"
              className="
                w-full bg-gray-800 placeholder-gray-400 text-text
                rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-accent
                transition
                "
            />
          </form>
          <nav className="space-x-4 flex-1">
            <Link to="/images">Images</Link>
            <Link to="/videos">Videos</Link>
            <Link to="/tags">Tags</Link>
            <Link to="/people">People</Link>
            <Link to="/map">Map</Link>
          </nav>
          {/* MENU BUTTON */}
          <button
            onClick={() => setOpenPanel(true)}
            className="
              flex items-center space-x-1 text-text hover:text-accent 
              focus:outline-none focus:ring-2 focus:ring-accent px-3 py-1
            "
          >
            <span>Menu</span>
            <svg
              className="h-4 w-4"
              fill="none" stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Control Panel Drawer */}
      {openPanel && <ControlPanelModal onClose={() => setOpenPanel(false)} />}
    </>
  )
}
