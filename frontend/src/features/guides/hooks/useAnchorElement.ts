import { useEffect, useState } from 'react';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useAnchorElement(anchorId: string | null): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!anchorId) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    function measure() {
      if (cancelled) return;
      const el = document.querySelector(
        `[data-guide-anchor="${CSS.escape(anchorId!)}"]`,
      ) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    measure();

    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);

    if (typeof ResizeObserver !== 'undefined') {
      const el = document.querySelector(`[data-guide-anchor="${CSS.escape(anchorId)}"]`);
      if (el) {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
      }
    }

    // Re-measure when any layout-affecting DOM mutation occurs
    mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [anchorId]);

  return rect;
}
