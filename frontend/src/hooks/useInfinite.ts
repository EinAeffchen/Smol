// src/hooks/useInfinite.ts
import { useState, useRef, useEffect, useCallback } from "react";

export type CursorResponse<T> = {
  items: T[];
  next_cursor: string | null;
};

export function useInfinite<T>(
  // fetchPage now takes (cursor, limit) and returns items + next_cursor
  fetchPage: (
    cursor: string | null,
    limit: number
  ) => Promise<CursorResponse<T>>,
  limit = 50,
  resetDeps: any[] = []
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);

    fetchPage(cursor, limit).then(({ items: newItems, next_cursor }) => {
      setItems((prev) => [...prev, ...newItems]);
      setCursor(next_cursor);
      setHasMore(next_cursor !== null);
      setLoading(false);
    });
  }, [cursor, fetchPage, hasMore, limit, loading]);

  // on mount or when resetDeps change, clear state and load first page
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  // intersection observer for infinite scroll
  useEffect(() => {
    if (loading || !hasMore) return;
    const el = loaderRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          obs.disconnect();
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [hasMore, loading, loadMore]);

  return { items, setItems, hasMore, loading, loaderRef };
}
