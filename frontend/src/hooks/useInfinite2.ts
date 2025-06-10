// In your hooks/useInfinite.ts file

import { useState, useEffect, useCallback, useRef } from "react";

export interface CursorResponse<T> {
  items: T[];
  // Ensure your API response uses 'next_cursor' as the key
  next_cursor: string | null;
}

export function useInfinite<T>(
  fetchPage: (
    cursor: string | null,
    limit: number
  ) => Promise<CursorResponse<T>>,
  limit: number,
  deps: any[] = []
) {
  const [pages, setPages] = useState<T[][]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const data = await fetchPage(cursorRef.current, limit);
      if (data.items.length > 0) {
        setPages((prevPages) => [...prevPages, data.items]);
      }
      cursorRef.current = data.next_cursor;
      setHasMore(data.next_cursor !== null);
    } catch (error) {
      console.error("Failed to fetch page:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, hasMore, loading, limit]);

  // This effect handles both resets and the initial data load when deps change
  useEffect(() => {
    setPages([]);
    setHasMore(true);
    cursorRef.current = null;
    loadMore(); // Trigger the very first page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // This observer handles all subsequent "load more" requests
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          loadMore();
        }
      },
      { rootMargin: "400px" } // Increased margin for a better UX
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loadMore, loading]);

  return { pages, loading, hasMore, loaderRef };
}
