// frontend/src/components/Header.tsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import ControlPanelModal from './ControlPanelModal'

export function Header() {
  const [openPanel, setOpenPanel] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">

          {/* LOGO ONLY */}
          <Link to="/">
            <img
              src="/logo.png"
              alt="SMOL logo"
              className="h-10 w-auto"  // enlarged 
            />
          </Link>

          {/* SEARCH BAR */}
          <form className="flex-1 mx-6 max-w-xl" role="search" onSubmit={e => e.preventDefault()}>
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
