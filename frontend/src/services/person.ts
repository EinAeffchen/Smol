import { API } from "../config";
import { Media, Person, PersonReadSimple, SimilarPersonWithDetails } from "../types";

export const getPeople = async (cursor?: string): Promise<{ items: PersonReadSimple[]; next_cursor: string | null }> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  const response = await fetch(`${API}/api/persons/?${params.toString()}`);
  const data = await response.json();
  return { items: data.items, next_cursor: data.next_cursor };
};

export const getPerson = async (id: string): Promise<Person> => {
  const response = await fetch(`${API}/api/persons/${id}`);
  return response.json();
};

export const getSimilarPeople = async (id: string): Promise<SimilarPersonWithDetails[]> => {
  const response = await fetch(`${API}/api/persons/similar/${id}`);
  return response.json();
};

export const getPersonMediaAppearances = async (personId: number, page: number, withPersonIds: number[] = []): Promise<Media[]> => {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  withPersonIds.forEach(id => params.append("with_person_ids", id.toString()));
  const response = await fetch(`${API}/api/persons/${personId}/media-appearances?${params.toString()}`);
  return response.json();
};
