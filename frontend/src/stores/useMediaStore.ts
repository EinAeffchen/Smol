import { create } from "zustand";
import { Media } from "../types";

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
  fetchInitial: (listKey: string) => Promise<void>;
  loadMore: (listKey: string) => Promise<void>;
}

const initialListState: MediaListState = {
  items: [],
  nextCursor: null,
  hasMore: true,
  isLoading: false,
};

export const useMediaStore = create<MediaStoreState>((set, get) => ({
  lists: {}, // Initial state is an empty object

  fetchInitial: async (listKey: string) => {
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
      // The listKey is the actual URL to fetch (without limit/cursor)
      const res = await fetch(`${listKey}&limit=30`);
      const data = await res.json();
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: {
            items: data.items,
            nextCursor: data.next_cursor,
            hasMore: !!data.next_cursor,
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

  loadMore: async (listKey: string) => {
    const currentList = get().lists[listKey];
    if (!currentList || currentList.isLoading || !currentList.hasMore) return;

    set((state) => ({
      lists: { ...state.lists, [listKey]: { ...currentList, isLoading: true } },
    }));

    try {
      const res = await fetch(
        `${listKey}&limit=30&cursor=${currentList.nextCursor}`
      );
      const data = await res.json();
      set((state) => ({
        lists: {
          ...state.lists,
          [listKey]: {
            ...currentList,
            items: [...currentList.items, ...data.items],
            nextCursor: data.next_cursor,
            hasMore: !!data.next_cursor,
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

// A default empty state to prevent errors before data is loaded
export const defaultListState: MediaListState = {
  items: [],
  nextCursor: null,
  hasMore: true,
  isLoading: false,
};
