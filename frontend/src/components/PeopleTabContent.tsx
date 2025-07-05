import React, { useState, useEffect } from "react";
import { PeopleSection } from "./PeopleSection";
import {
  assignFace,
  createPersonFromFaces,
  deleteFace,
  detachFace,
} from "../services/faceActions";
import { Person, Face } from "../types";

interface PeopleTabContentProps {
  initialPersons: Person[];
  initialOrphans: Face[];
  onDataChanged: () => void;
}

export function PeopleTabContent({
  initialPersons,
  initialOrphans,
  onDataChanged,
}: PeopleTabContentProps) {
  const [persons, setPersons] = useState(initialPersons);
  const [orphans, setOrphans] = useState(initialOrphans);

  useEffect(() => {
    setPersons(initialPersons);
    setOrphans(initialOrphans);
  }, [initialPersons, initialOrphans]);

  const handleDeleteFace = async (faceIds: number[]) => {
    await deleteFace(faceIds);
    setOrphans((prev) => prev.filter((f) => !faceIds.includes(f)));
    onDataChanged();
  };

  const handleAssignFace = async (faceIds: number[], personId: number) => {
    await assignFace(faceIds, personId);
    setOrphans((prev) => prev.filter((f) => !faceIds.includes(f)));
    onDataChanged();
  };

  const handleDetachFace = async (faceIds: number[]) => {
    await detachFace(faceIds);
    onDataChanged();
  };

  const handleCreateFace = async (faceId: number, data: any) => {
    const newPerson = await createPersonFromFaces([faceId], name);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
    onDataChanged();
    return newPerson;
  };

  return (
    <PeopleSection
      persons={persons}
      orphans={orphans}
      onAssign={handleAssignFace}
      onDeleteFace={handleDeleteFace}
      onDetachFace={handleDetachFace}
      onCreateFace={handleCreateFace}
    />
  );
}
