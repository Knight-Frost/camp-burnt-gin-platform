/**
 * Avatar.tsx
 *
 * Global user avatar component used across all portals.
 *
 * - Shows a profile photo when `src` is provided and loads correctly.
 * - Falls back to initials on broken / missing image.
 * - Accepts an optional `fallbackColor` so callers (e.g. messaging) can
 *   supply a deterministic per-participant colour instead of the default.
 */

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Public URL of the user's profile photo. */
  src?: string | null;
  /** Full name used to generate initials when no photo is available. */
  name: string;
  size?: AvatarSize;
  className?: string;
  /**
   * Background colour for the initials fallback.
   * Defaults to `var(--overlay-primary)` with `var(--ember-orange)` text.
   * Pass a hex/rgb string to override (useful for deterministic per-user colours).
   */
  fallbackColor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 80,
};

const FONT_MAP: Record<AvatarSize, string> = {
  xs: '9px',
  sm: '10px',
  md: '12px',
  lg: '16px',
  xl: '24px',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Avatar({ src, name, size = 'md', className = '', fallbackColor }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Reset error state whenever the src URL changes (e.g. after a new photo upload).
  useEffect(() => { setImgError(false); }, [src]);

  const px = SIZE_MAP[size];
  const fontSize = FONT_MAP[size];
  const showPhoto = src && !imgError;

  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '9999px',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default',
  };

  const hoverStyle = `
    .cbg-avatar-${size}:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0,0,0,0.16);
    }
  `;

  if (showPhoto) {
    return (
      <>
        <style>{hoverStyle}</style>
        <div style={baseStyle} className={`cbg-avatar-${size} ${className}`}>
          <img
            src={src}
            alt={name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      </>
    );
  }

  // Initials fallback
  const initials = getInitials(name);
  const fallbackBg = fallbackColor ?? 'var(--overlay-primary)';
  const fallbackText = fallbackColor ? '#fff' : 'var(--ember-orange)';

  return (
    <>
      <style>{hoverStyle}</style>
      <div
        style={{
          ...baseStyle,
          background: fallbackBg,
          color: fallbackText,
          fontSize,
          fontWeight: 600,
          letterSpacing: '0.02em',
          userSelect: 'none',
        }}
        className={`cbg-avatar-${size} ${className}`}
        aria-label={name}
      >
        {initials}
      </div>
    </>
  );
}
