import { useEffect, useRef, useState } from 'react';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface AnchorResult {
  rect: AnchorRect | null;
  searching: boolean;
}

const POLL_INTERVAL_MS = 100;
// Most anchors are present at first render; only a few are lazy-rendered
// (e.g., the first item in an async-loaded list). 800ms is enough to catch
// those without making the UI feel frozen when an anchor is genuinely
// missing — the centered fallback can take over quickly.
const POLL_TIMEOUT_MS  = 800;

function queryAnchor(anchorId: string): HTMLElement | null {
  return document.querySelector(
    `[data-guide-anchor="${CSS.escape(anchorId)}"]`,
  ) as HTMLElement | null;
}

function measureEl(el: HTMLElement): AnchorRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function useAnchorElement(anchorId: string | null): AnchorResult {
  const [rect, setRect]         = useState<AnchorRect | null>(null);
  const [searching, setSearching] = useState(true);
  const anchorRef = useRef(anchorId);
  anchorRef.current = anchorId;

  useEffect(() => {
    if (!anchorId) {
      setRect(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setRect(null);

    let cancelled     = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    function measure() {
      if (cancelled) return;
      const el = queryAnchor(anchorId!);
      if (!el) {
        setRect(null);
        return;
      }
      setRect(measureEl(el));
    }

    function stopPolling() {
      if (pollId !== null)   { clearInterval(pollId);   pollId   = null; }
      if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    }

    function attachObservers(el: HTMLElement) {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
      }
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
    }

    function foundElement(el: HTMLElement) {
      stopPolling();
      if (cancelled) return;
      setRect(measureEl(el));
      setSearching(false);
      attachObservers(el);
    }

    // Try immediately
    const immediate = queryAnchor(anchorId);
    if (immediate) {
      foundElement(immediate);
    } else {
      // Poll until found or timeout
      pollId = setInterval(() => {
        if (cancelled) { stopPolling(); return; }
        const el = queryAnchor(anchorRef.current!);
        if (el) { foundElement(el); }
      }, POLL_INTERVAL_MS);

      timeoutId = setTimeout(() => {
        stopPolling();
        if (!cancelled) setSearching(false);
      }, POLL_TIMEOUT_MS);
    }

    return () => {
      cancelled = true;
      stopPolling();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorId]);

  return { rect, searching };
}
