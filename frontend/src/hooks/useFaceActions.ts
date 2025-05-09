import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Person, FaceRead } from "../types";

const API = import.meta.env.VITE_API_BASE_URL!;

export function useFaceActions() {
  const navigate = useNavigate();
  /** assign an existing face to a person */
  const assignFace = useCallback(async (faceId: number, personId: number) => {
    const res = await fetch(`${API}/faces/${faceId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: personId }),
    });
    if (!res.ok) throw new Error("Failed to assign face");
    return res.json() as Promise<FaceRead>;
  }, []);

  /** create a brand-new person from a face */
  const createPersonFromFace = useCallback(
    async (
      faceId: number,
      data: {
        name?: string;
        age?: number;
        gender?: string;
      }
    ): Promise<Person> => {
      const res = await fetch(`${API}/faces/${faceId}/create_person`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      console.log("🚀 Payload:", data)
      if (!res.ok) {
        const err = await res.text();
        console.error("❌ createPersonFromFace error:", err);
        throw new Error(err);
      }
      const json = await res.json();
      return json.person ?? json;
    },
    [navigate]
  );

  /** delete a face record */
  const deleteFace = useCallback(async (faceId: number) => {
    const res = await fetch(`${API}/faces/${faceId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete face");
  }, []);

  /** set which detected face is the “profile” for a person */
  const setProfileFace = useCallback(
    async (faceId: number, personId: number) => {
      const res = await fetch(`${API}/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_face_id: faceId }),
      });
      if (!res.ok) throw new Error("Failed to set profile face");
      return res.json() as Promise<Person>;
    },
    []
  );

  return {
    assignFace,
    createPersonFromFace,
    deleteFace,
    setProfileFace,
  };
}
