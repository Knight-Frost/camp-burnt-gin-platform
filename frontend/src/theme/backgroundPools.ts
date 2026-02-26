/**
 * Background Pool Engine
 *
 * Single cinematic pool — warm lantern nights, campfire amber glow, deep navy sky.
 * Dark mode only.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackgroundPool {
  images: readonly string[];
  /** Base color overlay applied above the photo layer */
  baseOverlay: string;
  /** Cinematic vignette for this pool */
  vignette: string;
  /** Image opacity range [atTop, atBottom] */
  imageOpacity: [number, number];
}

// ─── Pool: Dark ───────────────────────────────────────────────────────────────
// Aesthetic: warm lantern nights, campfire amber glow, deep navy sky

const DARK_POOL: BackgroundPool = {
  images: [
    'https://images.unsplash.com/photo-1699811250891-1366dc5701d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1wZmlyZSUyMG5pZ2h0JTIwa2lkcyUyMGNpcmNsZSUyMHRvZ2V0aGVyfGVufDF8fHx8MTc3MDM0NTU2Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1625705791861-6d729eef7597?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW1tZXIlMjBjYW1wJTIwY2FtcGZpcmUlMjBldmVuaW5nJTIwa2lkc3xlbnwxfHx8fDE3NzAzNDM5MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1615909340810-3ec0e50f9e4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRzJTIwY3JhZnRzJTIwY2hpbGRyZW4lMjBtYWtpbmclMjBwYWludGluZ3xlbnwxfHx8fDE3NzAzNDQwNTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1701834951900-b31c99da66f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwa2lkcyUyMGdyb3VwJTIwc21pbGluZyUyMGhhcHB5fGVufDF8fHx8MTc3MDM0MTkyMXww&ixlib=rb-4.1.0&q=80&w=1080',
  ],
  baseOverlay: 'rgba(0,0,0,0)',
  vignette: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.62) 100%)',
  imageOpacity: [0.48, 0.62],
};

// ─── Pool resolver (pure function, no side effects) ───────────────────────────

export function getBackgroundPool(_resolvedTheme?: 'dark' | 'light'): BackgroundPool {
  return DARK_POOL;
}
