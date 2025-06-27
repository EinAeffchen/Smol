import { useState, useRef, useEffect, useCallback } from "react";

export type PageResponse<T> = {
  items: T[];
  next_cursor: string | null;
};

export function useInfinite<T>(
  fetchPage: (
    cursor?: string
  ) => Promise<PageResponse<T>>,
  resetDeps: any[] = [],
  disabled: boolean = false
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);

    fetchPage(cursor).then(({ items: newItems, next_cursor }) => {
      setItems((prev) => [...prev, ...newItems]);
      setCursor(next_cursor || undefined);
      setHasMore(next_cursor !== null);
      setLoading(false);
    });
  }, [cursor, fetchPage, hasMore, loading]);

  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    setLoading(true);
    fetchPage(undefined).then(({ items: firstItems, next_cursor }) => {
      setItems(firstItems);
      setCursor(next_cursor || undefined);
      setHasMore(next_cursor !== null);
      setLoading(false);
    });
  }, resetDeps);

  useEffect(() => {
    if (disabled) return;
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

  return { items, setItems, hasMore, loading, loaderRef, disabled };
}
