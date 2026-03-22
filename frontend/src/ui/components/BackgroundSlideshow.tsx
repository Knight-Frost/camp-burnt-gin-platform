/**
 * BackgroundSlideshow.tsx
 *
 * Renders a full-cover crossfading photo background.
 * All images are always mounted; opacity transitions handle the crossfade.
 * Pure CSS — no Framer Motion, minimal JS.
 *
 * Usage: place inside a `position: relative; overflow: hidden` container.
 */

import { useState, useEffect } from 'react';

const IMAGES = [
  '/backgrounds/bg-mountain-river.jpg',
  '/backgrounds/bg-italy.jpg',
  '/backgrounds/bg-rocky-stream.jpg',
  '/backgrounds/bg-lantern.jpg',
];

/** Milliseconds each photo stays visible before crossfading */
const HOLD_MS = 9000;
/** Crossfade duration — must match the CSS transition below */
const FADE_MS = 2200;

export function BackgroundSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % IMAGES.length);
    }, HOLD_MS + FADE_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            opacity: i === activeIndex ? 1 : 0,
            // Slight scale on active image gives a subtle Ken Burns feel
            transform: i === activeIndex ? 'scale(1.03)' : 'scale(1)',
            transitionProperty: 'opacity, transform',
            transitionDuration: `${FADE_MS}ms`,
            transitionTimingFunction: 'ease-in-out',
            willChange: 'opacity, transform',
          }}
        />
      ))}
    </div>
  );
}
