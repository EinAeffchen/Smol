// src/hooks/useInfinite.ts
import { useState, useRef, useEffect, useCallback } from "react";

export function useInfinite<T>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  limit = 50
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  // when `page` changes, fetch exactly that page
  useEffect(() => {
    let cancelled = false;
    const skip = page * limit;

    fetchPage(skip, limit).then((newItems) => {
      if (cancelled) return;
      setItems((prev) => (page === 0 ? newItems : [...prev, ...newItems]));
      setHasMore(newItems.length === limit);
    });

    return () => {
      cancelled = true;
    };
  }, [page, limit, fetchPage]);

  // observe the loader element once (or whenever hasMore flips)
  useEffect(() => {
    if (!hasMore) return;
    const el = loaderRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // advance to next page exactly once per intersection
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "200px" }
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
    };
  }, [hasMore]);

  return { items, hasMore, loaderRef };
}
