"use client";

import * as React from "react";

export function useTimeouts() {
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const set = React.useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const clear = React.useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  React.useEffect(() => clear, [clear]);

  return { set, clear };
}

export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query],
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined") return serverFallback;
    return window.matchMedia(query).matches;
  }, [query, serverFallback]);

  const getServerSnapshot = React.useCallback(() => serverFallback, [serverFallback]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useInViewState<T extends Element>() {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

export function useInViewRef<T extends Element>() {
  const ref = React.useRef<T | null>(null);
  const inView = React.useRef(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    inView.current = false;
    const io = new IntersectionObserver(
      ([entry]) => { inView.current = entry.isIntersecting; },
      { rootMargin: "100px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}
