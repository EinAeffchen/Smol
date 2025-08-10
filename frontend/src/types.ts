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
  thumbnail_path?: string;
  extracted_scenes: boolean;
}

export interface ProfileFace {
  id: number;
  thumbnail_path?: string;
  media_id?: number;
}

export interface PersonReadSimple {
  id: number;
  name?: string;
  profile_face: ProfileFace;
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
  tags: Tag[];
  appearance_count: number;
  profile_face_id?: number;
  profile_face?: Face;
}

export interface PersonIndex {
  id: number;
  name?: string;
}
export interface Face {
  id: number;
  media_id: number;
  person_id?: number;
  thumbnail_path: string;
  person?: Person;
}
export interface FaceRead {
  id: number;
  media_id: number;
  thumbnail_path: string;
}

export interface MediaDetail {
  media: Media;
  persons: Person[];
  orphans: Face[];
}

export type TaskType =
  | "process_media"
  | "clean_missing_files"
  | "cluster_persons"
  | "scan"
  | "find_duplicates";
export type TaskStatus = "pending" | "running" | "completed" | "cancelled";

export interface Task {
  id: string;
  task_type: TaskType;
  status: TaskStatus;
  total: number;
  processed: number;
}

export interface SimilarPersonWithDetails {
  id: number;
  name?: string;
  similarity: number;
  thumbnail?: string;
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
  path: string;
  size: number;
  thumbnail_path: string;
  duration?: number;
  width?: number;
  height?: number;
  views: number;
  inserted_at: string;
}

export interface MediaDuplicate extends MediaPreview {
  size: number;
  path: string;
}

export interface DuplicateGroup {
  id: number;
  items: MediaDuplicate[];
  group_id: number;
}

export interface SceneRead {
  id: number;
  start_time: number;
  end_time: number;
  thumbnail_path: string;
  description: string;
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

export interface MediaIndex {
  id: number;
  path: string;
  filename: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  views: number;
  inserted_at: string; // ISO date
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface DuplicatePage {
  items: MediaPreview[][];
  next_cursor: number | null;
}

// Timeline
export interface TimelineEvent {
  id: number;
  title: string;
  description?: string;
  event_date: Date; // ISO date string e.g., "2025-06-30"
  recurrence?: "yearly";
  person_id: number;
}

export type TimelineEventCreate = Omit<TimelineEvent, "id" | "person_id">;
export type TimelineEventUpdate = Partial<TimelineEventCreate>;
export interface TimelineMediaItem {
  type: "media";
  date: string;
  items: MediaPreview;
}

export interface TimelineEventItem {
  type: "event";
  date: string;
  items: TimelineEvent;
}
export interface MediaItemGroup {
  type: "media_group";
  date: string;
  items: MediaPreview[];
}

// This represents an event, which is displayed individually
export interface EventDisplayItem {
  type: "event";
  date: string;
  event: TimelineEvent;
}

export type TimelineItem = TimelineMediaItem | TimelineEventItem;
export type TimelineDisplayItem = MediaItemGroup | EventDisplayItem;

export interface AppConfig {
  general: {
    port: number;
    read_only: boolean;
    enable_people: boolean;
    domain: string;
    thumb_dir_folder_size: number;
    data_dir: string;
    database_dir: string;
    smol_dir: string;
    thumb_dir: string;
    media_dirs: string[];
    static_dir: string;
    models_dir: string;
    database_url: string;
  };
  scan: {
    auto_scan: boolean;
    scan_interval_minutes: number;
    auto_clean_on_scan: boolean;
    auto_cluster_on_scan: boolean;
    auto_rotate: boolean;
    VIDEO_SUFFIXES: string[];
    IMAGE_SUFFIXES: string[];
  };
  ai: {
    clip_model_enum: (string | number)[];
    clip_model: string;
    clip_model_embedding_size: number;
    clip_model_pretrained: string;
    min_search_dist: number;
    min_similarity_dist: number;
    cluster_batch_size: number;
  };
  tagging: {
    auto_tagging: boolean;
    use_default_tags: boolean;
    custom_tags: string[];
  };
  face_recognition: {
    face_recognition_min_confidence: number;
    face_match_cosine_threshold: number;
    face_recognition_min_face_pixels: number;
    person_min_face_count: number;
  };
  duplicates: {
    duplicate_auto_handling: string;
    duplicate_auto_keep_rule: string;
  };
  video: {
    auto_scene_detection: boolean;
    max_frames_per_video: number;
  };
  processors: {
    exif_processor_active: boolean;
    face_processor_active: boolean;
    image_embedding_processor_active: boolean;
  };
}
