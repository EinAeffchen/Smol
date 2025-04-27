export interface Media {
  id: number;
  path: string;
  filename: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  views: number;
  inserted_at: string;
  tags: Tag[];
  faces: Face[];
}

export interface Tag {
  id: number;
  name: string;
  media: Media[];
  persons: Person[];
}

export interface Person {
  id: number;
  name?: string;
  age?: number;
  gender?: string;
  profile_face_id?: number;
  profile_face?: Face;
}

export interface Face {
  id: number;
  media_id: number;
  person_id?: number;
  thumbnail_path: string;
  bbox: number[];
  embedding?: number[];
  person?: Person;
}

export interface MediaDetail {
  media: Media;
  persons: Person[];
}
export interface PersonDetail {
  person: Person;
  faces: Face[];
  medias: Media[];
}

type TaskType = "process_media" | "cluster_persons" | "scan_folder";
type TaskStatus = "pending" | "running" | "completed" | "cancelled";

export interface Task {
  id: string;
  task_type: TaskType;
  status: TaskStatus;
  total: number;
  processed: number;
}

export interface SimilarPerson {
  id: number;
  name?: string;
  similarity: number;
  thumbnail?: string;
}

export interface MediaPreview {
  id: number;
  filename: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  views: number;
  inserted_at: string;
}

export interface MediaLocation {
  id: number;
  latitude: number;
  longitude: number;
  thumbnail: string;
}

export interface SearchResult {
  media: Media[];
  persons: Person[];
  tags: Tag[];
}
