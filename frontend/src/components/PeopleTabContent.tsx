import React, { useState, useEffect } from "react";
import { PeopleSection } from "./PeopleSection";
import { useFaceActions } from "../hooks/useFaceActions";
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
  const faceActions = useFaceActions();

  useEffect(() => {
    setPersons(initialPersons);
    setOrphans(initialOrphans);
  }, [initialPersons, initialOrphans]);

  const handleDeleteFace = async (faceId: number) => {
    await faceActions.deleteFace(faceId);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
    onDataChanged();
  };

  const handleAssignFace = async (faceId: number, personId: number) => {
    await faceActions.assignFace(faceId, personId);
    setOrphans((prev) => prev.filter((f) => f.id !== faceId));
    onDataChanged();
  };

  const handleDetachFace = async (faceId: number) => {
    await faceActions.detachFace(faceId);
    onDataChanged();
  };

  const handleCreateFace = async (faceId: number, data: any) => {
    const newPerson = await faceActions.createPersonFromFace(faceId, data);
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
