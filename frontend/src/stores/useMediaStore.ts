import { create } from "zustand";
import { Media } from "../types";

// Define the shape of the state for a SINGLE paginated list
import { create } from "zustand";
import { Media, CursorPage } from "../types";

// Define the shape of the state for a SINGLE paginated list
export interface MediaListState {
  items: Media[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
}

// Define the shape of the entire store, which holds multiple lists
interface MediaStoreState {
  // A dictionary where the key is a URL string and the value is the list's state
  lists: Record<string, MediaListState>;

  // Actions now take a `listKey` to know which list to operate on
  fetchInitial: (
    listKey: string,
    fetcher: () => Promise<CursorPage<Media>>
  ) => Promise<void>;
  loadMore: (
    listKey: string,
    fetcher: (cursor: string | null) => Promise<CursorPage<Media>>
  ) => Promise<void>;
}

const initialListState: MediaListState = {
  items: [],
  nextCursor: null,
  hasMore: true,
  isLoading: false,
};
export const noContextListState: MediaListState = {
  ...initialListState,
  hasMore: false,
};

export const defaultListState: MediaListState = initialListState;

export const useMediaStore = create<MediaStoreState>((set, get) => ({
  lists: {}, // Initial state is an empty object

  fetchInitial: async (
    listKey: string,
    fetcher: () => Promise<CursorPage<Media>>
  ) => {
    // Prevent refetch if already loading this specific list
    if (get().lists[listKey]?.isLoading) return;

    // Set the loading state for this specific list
    set((state) => ({
      lists: {
        ...state.lists,
        [listKey]: { ...initialListState, isLoading: true },
      },
    }));

    try {
      const response = await fetcher();
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: {
            items: response.items,
            nextCursor: response.next_cursor,
            hasMore: response.next_cursor !== null,
            isLoading: false,
          },
        },
      }));
    } catch (error) {
      console.error(`Failed to fetch initial media for ${listKey}:`, error);
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: { ...initialListState, hasMore: false },
        },
      }));
    }
  },

  loadMore: async (
    listKey: string,
    fetcher: (cursor: string | null) => Promise<CursorPage<Media>>
  ) => {
    const currentList = get().lists[listKey];
    if (!currentList || currentList.isLoading || !currentList.hasMore) return;

    set((state) => ({
      lists: { ...state.lists, [listKey]: { ...currentList, isLoading: true } },
    }));

    try {
      const response = await fetcher(currentList.nextCursor);
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: {
            ...currentList,
            items: [...currentList.items, ...response.items],
            nextCursor: response.next_cursor,
            hasMore: response.next_cursor !== null,
            isLoading: false,
          },
        },
      }));
    } catch (error) {
      console.error(`Failed to load more media for ${listKey}:`, error);
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: { ...currentList, hasMore: false },
        },
      }));
    }
  },
}));
