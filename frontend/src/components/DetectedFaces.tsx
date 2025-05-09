import React from 'react'
import FaceCard from './FaceCard'
import { FaceRead, Person } from '../types'

const API = import.meta.env.VITE_API_BASE_URL!

interface DetectedFacesProps {
    /** The faces to render (either assigned or suggested) */
    faces: FaceRead[]
    /** ID of current profile face (only applies to assigned faces) */
    profileFaceId?: number
    /** Layout: if true, render a horizontal scroll carousel */
    horizontal?: boolean
    /** Callbacks for each action */
    onSetProfile: (faceId: number) => void
    onAssign: (faceId: number, personId: number) => void
    onCreate: (faceId: number, data: any) => Promise<Person>
    onDelete: (faceId: number) => void
}

export default function DetectedFaces({
    faces,
    profileFaceId,
    horizontal = false,
    onSetProfile,
    onAssign,
    onCreate,
    onDelete,
}: DetectedFacesProps) {
    const containerClass = horizontal
        ? 'flex gap-4 overflow-x-auto py-2'
        : 'grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 max-h-[24rem] overflow-y-auto pr-2'

    return (
        <section className={horizontal ? 'space-y-2' : ''}>
            <h2 className="text-lg font-semibold mb-2">
                {horizontal ? 'Is this the same person?' : 'Detected Faces'}
            </h2>
            <div className={containerClass}>
                {faces.map(face => (
                    <FaceCard
                        key={face.id}
                        face={face}
                        isProfile={face.id === profileFaceId}
                        onSetProfile={() => onSetProfile(face.id)}
                        onAssign={pid => onAssign(face.id, pid)}
                        onCreate={data => onCreate(face.id, data)}
                        onDelete={() => onDelete(face.id)}
                    />
                ))}
            </div>
        </section>
    )
}
