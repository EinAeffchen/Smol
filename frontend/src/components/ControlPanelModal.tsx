// frontend/src/components/ControlPanelModal.tsx
import React from 'react'
import TasksPanel from './TasksPanel'

interface Props {
  onClose: () => void
}

export default function ControlPanelModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-30 flex justify-end">
      {/* click on the backdrop to close */}
      <div className="flex-1" onClick={onClose} />
      {/* Drawer */}
      <div className="w-80 max-w-full bg-background shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-text">Control Panel</h3>
          <button 
            onClick={onClose} 
            className="text-text hover:text-accent text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4">
          <TasksPanel />
          {/* you can add more panels here */}
        </div>
      </div>
    </div>
  )
}
