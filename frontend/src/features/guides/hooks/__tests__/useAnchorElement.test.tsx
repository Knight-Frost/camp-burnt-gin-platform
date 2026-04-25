import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnchorElement } from '@/features/guides/hooks/useAnchorElement';

const insertedElements: HTMLElement[] = [];

beforeEach(() => {
  if (!('ResizeObserver' in window)) {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
  }
  vi.spyOn(window, 'MutationObserver').mockImplementation(
    () =>
      ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      }) as unknown as MutationObserver
  );
});

afterEach(() => {
  for (const el of insertedElements) {
    el.parentNode?.removeChild(el);
  }
  insertedElements.length = 0;
  vi.restoreAllMocks();
});

function insertAnchor(anchorId: string): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute('data-guide-anchor', anchorId);
  document.body.appendChild(div);
  insertedElements.push(div);
  return div;
}

function mockRect(partial: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 0,
    left: 0,
    width: 100,
    height: 50,
    bottom: 50,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect;
}

describe('useAnchorElement — null anchorId', () => {
  test('returns null when anchorId is null', () => {
    const { result } = renderHook(() => useAnchorElement(null));
    expect(result.current).toBeNull();
  });
});

describe('useAnchorElement — element not in DOM', () => {
  test('returns null when no element with that anchor exists', () => {
    const { result } = renderHook(() => useAnchorElement('nonexistent-anchor'));
    expect(result.current).toBeNull();
  });
});

describe('useAnchorElement — element present in DOM', () => {
  test('returns an AnchorRect when the element exists', () => {
    insertAnchor('test-anchor');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      mockRect({ top: 10, left: 20, width: 100, height: 40 })
    );

    const { result } = renderHook(() => useAnchorElement('test-anchor'));

    expect(result.current).not.toBeNull();
    expect(result.current?.top).toBe(10);
    expect(result.current?.left).toBe(20);
    expect(result.current?.width).toBe(100);
    expect(result.current?.height).toBe(40);
  });

  test('AnchorRect has all four required fields', () => {
    insertAnchor('rect-anchor');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      mockRect({ top: 5, left: 15, width: 200, height: 80 })
    );

    const { result } = renderHook(() => useAnchorElement('rect-anchor'));

    const rect = result.current;
    expect(rect).toHaveProperty('top');
    expect(rect).toHaveProperty('left');
    expect(rect).toHaveProperty('width');
    expect(rect).toHaveProperty('height');
  });
});

describe('useAnchorElement — anchor id changes to null', () => {
  test('returns null when anchorId changes from a value to null', () => {
    insertAnchor('switchable-anchor');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      mockRect({ top: 0, left: 0, width: 50, height: 50 })
    );

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useAnchorElement(id),
      { initialProps: { id: 'switchable-anchor' as string | null } }
    );
    expect(result.current).not.toBeNull();

    rerender({ id: null });
    expect(result.current).toBeNull();
  });
});
