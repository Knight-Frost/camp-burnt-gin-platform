# Theme Background Switch Fix Report

**Date:** 2026-02-22
**Branch:** frontend
**Backend modified:** No

---

## Root Cause

`LivingBackground` was not consuming the pool system at all. The component retained
a hardcoded 13-item `campImages` constant (all dark campfire/evening imagery) that
was never replaced when `backgroundPools.ts` was created. Every pool resolution
method existed in the module but was never imported or called inside the component.

**Before fix:**
- Line 8–24: hardcoded `campImages` array (dark mode only)
- Line 38: `(prev + 1) % campImages.length` — always the same array
- Lines 103, 117: `campImages[previousImageIndex]`, `campImages[currentImageIndex]`
- `getBackgroundPool()` — never imported, never called

---

## Confirmation: Legacy Arrays Removed

The `campImages` constant has been deleted entirely from `LivingBackground.tsx`.
No hardcoded fallback image array exists anywhere in the component.

---

## Confirmation: Distinct Image URLs Per Pool

| Pool | Sample images | Visual character |
|------|--------------|-----------------|
| `dark-summer` | Campfire circles, lantern warm light, bonfire gatherings, twilight dusk | Warm amber/orange, deep navy night |
| `dark-winter` | Winter starlit sky, campfire in snow, frost evening with lights, clear winter landscape | Cool blue-grey nights, muted amber |
| `light-summer` | Lake swimming, outdoor activities in sunshine, arts & crafts bright, golden meadow, children laughing | Warm gold daylight, energetic color |
| `light-winter` | Snow outdoor play, crisp frost morning, bright winter sky, frosty activities, silver birch forest | Cool silver-blue, clean brightness |

Zero image URLs are shared across pools.

---

## How LivingBackground Now Consumes getBackgroundPool()

### 1. Time-of-day state
```typescript
const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay);
// Refreshes every 60 s — drives overlay tonal shift in auto mode
```

### 2. Pool resolution via useMemo
```typescript
const activePool = useMemo(
  () => getBackgroundPool(resolvedTheme, resolvedSeason, timeOfDay),
  [resolvedTheme, resolvedSeason, timeOfDay],
);
```
`getBackgroundPool()` is a pure function returning a shallow copy of the module-level
pool constant with the appropriate `timeOverlay` injected. The pool images array is
the module constant itself — no allocation.

### 3. Stable pool ref (for the interval)
```typescript
const activePoolRef = useRef(activePool);
useEffect(() => { activePoolRef.current = activePool; }, [activePool]);
```
The image rotation interval is mounted once (empty deps). It reads `activePoolRef.current`
on every tick, so it always uses the current pool without restarting.

### 4. Pool switch effect — crossfade on theme/season change
```typescript
useEffect(() => {
  if (prevPoolKeyRef.current === poolKey) return;
  prevPoolKeyRef.current = poolKey;
  displayIndexRef.current = 0;
  setDisplayedImages((prev) => ({
    previous: prev.current,   // outgoing: last visible image from old pool
    current:  activePool.images[0] ?? '', // incoming: first image of new pool
  }));
}, [poolKey, activePool]);
```
When the user switches mode or season, `poolKey` changes, the old image fades out,
and the new pool's first image fades in — using the existing Framer Motion dual-buffer
crossfade mechanism. The gradient RAF loop and interval are untouched.

### 5. Image display
```tsx
<motion.div key={`prev-${displayedImages.previous}`} ... />
<motion.div key={`curr-${displayedImages.current}`}  ... />
```
Keys are the actual image URL strings. React unmounts/mounts on URL change,
which Framer Motion detects and drives the opacity crossfade.

### 6. Image opacity from pool spec
```typescript
const [opacityTop, opacityBottom] = activePool.imageOpacity;
```
Dark pools: `[0.48, 0.62]` — photos are prominent
Light pools: `[0.09–0.10, 0.15–0.16]` — photos are subtle background wash

### 7. Time-of-day overlay layer
```tsx
{activePool.timeOverlay !== 'none' && (
  <motion.div animate={{ background: activePool.timeOverlay }} ... />
)}
```
Adds a gradient tint above the photo layer:
- `sunrise`: warm gold from top (rgba 255,185,60 @ 0.18)
- `noon`: minimal neutral (rgba 255,248,220 @ 0.08)
- `sunset`: amber burn (rgba 244,114,66 @ 0.22 → 0.10)
- `night`: no overlay rendered

---

## Performance Safeguards

| Concern | Solution |
|---------|---------|
| Image rotation interval restart | Single `useEffect(fn, [])` — only mounts once; reads from `activePoolRef` |
| Pool constant allocation | Module-level constants — `getBackgroundPool()` returns shallow copy with `timeOverlay` spliced |
| RAF loop (gradient morphing) | Separate `useEffect(fn, [])` — completely independent of pool/theme state |
| Full tree re-render on pool change | Only `displayedImages` state changes; gradient phase RAF causes targeted re-render of LivingBackground only |
| Layout shift | All layers are `position: absolute; inset: 0` — no reflow |
| Framer Motion crossfade | `willChange: 'transform, opacity'` promotes layers to GPU compositor |

---

## Visual Expectations Per Combination

| Combination | Expected imagery | Opacity |
|-------------|-----------------|---------|
| Dark + Summer | Warm campfire amber, deep navy nights | 48–62% |
| Dark + Winter | Cool starlit frost, muted blue-grey | 42–56% |
| Light + Summer | Bright lake daylight, golden outdoor | 10–16% |
| Light + Winter | Crisp snow scenes, silver-blue sky | 9–15% |

Switching any mode or season triggers an immediate crossfade to the first image
of the newly selected pool (2.2 s ease). The gradient base layer transitions
simultaneously over 8 s.

---

## Backend Status

**No backend files were modified.**

---

## Build Verification

```
pnpm run lint        → 0 errors, 0 warnings
pnpm run type-check  → 0 errors
pnpm run build       → ✓ built in 2.64 s
```
