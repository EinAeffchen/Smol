// frontend/src/components/ControlPanelModal.tsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import TasksPanel from './TasksPanel'
import { READ_ONLY } from '../config'

export default function ControlPanelModal({ onClose }: { onClose(): void }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-30 flex justify-end"
      onClick={onClose}
    >
      {/* drawer panel */}
      <div
        className="w-64 max-w-full h-full bg-background p-4 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* close button */}
        <button
          onClick={onClose}
          className="mb-6 px-2 py-1 bg-gray-700 rounded text-text hover:bg-gray-600"
        >
          Close
        </button>

        {/* --- Mobile nav links --- */}
        <nav className="md:hidden flex flex-col space-y-3 mb-6">
          <NavLink
            to="/images"
            className={({ isActive }) =>
              `block px-2 py-1 rounded ${isActive ? 'bg-accent text-background' : 'hover:bg-gray-700'
              }`
            }
          >
            Images
          </NavLink>
          <NavLink
            to="/videos"
            className={({ isActive }) =>
              `block px-2 py-1 rounded ${isActive ? 'bg-accent text-background' : 'hover:bg-gray-700'
              }`
            }
          >
            Videos
          </NavLink>
          <NavLink
            to="/tags"
            className={({ isActive }) =>
              `block px-2 py-1 rounded ${isActive ? 'bg-accent text-background' : 'hover:bg-gray-700'
              }`
            }
          >
            Tags
          </NavLink>
          <NavLink
            to="/people"
            className={({ isActive }) =>
              `block px-2 py-1 rounded ${isActive ? 'bg-accent text-background' : 'hover:bg-gray-700'
              }`
            }
          >
            People
          </NavLink>
          <NavLink
            to="/map"
            className={({ isActive }) =>
              `block px-2 py-1 rounded ${isActive ? 'bg-accent text-background' : 'hover:bg-gray-700'
              }`
            }
          >
            Map
          </NavLink>
        </nav>

        {/* --- Your existing task panel component below --- */}
        {!READ_ONLY && (
          < TasksPanel />
        )}
      </div>
    </div>
  )
}
