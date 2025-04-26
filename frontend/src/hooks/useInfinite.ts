// src/hooks/useInfinite.ts
import { useState, useRef, useEffect, useCallback } from "react";

export function useInfinite<T>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  limit = 50
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  // when `page` changes, fetch exactly that page
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const skip = page * limit;

    fetchPage(skip, limit).then((newItems) => {
      if (cancelled) return;
      setItems((prev) => (page === 0 ? newItems : [...prev, ...newItems]));
      setHasMore(newItems.length === limit);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [page, limit, fetchPage]);

  // observe the loader element once (or whenever hasMore flips)
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = loaderRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // advance to next page exactly once per intersection
          obs.disconnect();
          setPage((current) => current + 1);
        }
      },
      { rootMargin: "200px" }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [hasMore, loading]);

  return { items, hasMore, loading, loaderRef };
}
