import type { RiskLevelColor } from '@/features/admin/types/admin.types';

interface RiskGaugeProps {
  score: number;             // 0–100
  size?: number;             // outer SVG bounding size in px (default 200)
  riskLevelColor?: RiskLevelColor; // DB-driven risk level — drives needle color and badge label
}

// ── Colour helpers ─────────────────────────────────────────────────────────────
//
// Visual zone thirds (33/67) are fixed — they are a VISUAL GUIDE for "roughly
// low / mid / high on the scale", not the exact operational thresholds.  The
// actual DB-configured threshold decision is surfaced via `riskLevelColor`.

const LEVEL_COLORS: Record<RiskLevelColor, string> = {
  low:      '#16a34a',
  moderate: '#d97706',
  high:     '#dc2626',
};

const LEVEL_LABELS: Record<RiskLevelColor, string> = {
  low:      'Low Risk',
  moderate: 'Moderate Risk',
  high:     'High Risk',
};

function scoreToLevelColor(s: number): RiskLevelColor {
  if (s >= 67) return 'high';
  if (s >= 34) return 'moderate';
  return 'low';
}

// ── Geometry constants ─────────────────────────────────────────────────────────
//
// Arc orientation (classic speedometer):
//   • 0 % at 195° (lower-left)       → START_DEG
//   • 100 % at 345° (lower-right)     → START_DEG + SWEEP_DEG
//   • Arc sweeps clockwise via the top (270° = apex)
//   • SVG y-axis is inverted, so 270° is visually at the top of the SVG

const START_DEG = 195;
const SWEEP_DEG = 210;

/**
 * RiskGauge — speedometer-style risk meter.
 *
 * Visual elements:
 *   1. Three equal zone arcs (Low / Moderate / High) as the muted track background
 *   2. Filled score arc from 0 to current score, colour-matched to the risk level
 *   3. Zone-boundary tick marks at 0 %, 33 %, 67 %, 100 %
 *   4. Needle — thin line from hub to arc track
 *   5. Hub — coloured outer circle + white inner dot
 *   6. Score label + " / 100" text in the bowl of the arc
 *   7. "Low" / "High" labels at the arc endpoints
 *   8. Risk-level pill badge below the SVG
 *
 * Zone arcs are always equal thirds (33/67) for visual clarity.
 * The `riskLevelColor` prop drives the needle colour and badge label using
 * the DB-resolved risk tier — so the visual adapts to threshold changes
 * without distorting the arc proportions.
 */
export function RiskGauge({ score, size = 200, riskLevelColor }: RiskGaugeProps) {
  // ── Layout geometry ──────────────────────────────────────────────────────────
  const cx = size / 2;        // horizontal centre
  const cy = size * 0.50;     // vertical pivot
  const r  = size * 0.385;    // arc track radius
  const sw = size * 0.067;    // arc track stroke width

  const toRad  = (deg: number) => (deg * Math.PI) / 180;
  const polar  = (deg: number, radius = r) => ({
    x: cx + radius * Math.cos(toRad(deg)),
    y: cy + radius * Math.sin(toRad(deg)),
  });

  /** SVG arc path for a score-percentage span [fromPct, toPct] */
  const arcPath = (fromPct: number, toPct: number): string => {
    const startDeg = START_DEG + (fromPct / 100) * SWEEP_DEG;
    const endDeg   = START_DEG + (toPct  / 100) * SWEEP_DEG;
    const s        = polar(startDeg);
    const e        = polar(endDeg);
    const large    = toPct - fromPct > 50 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  // ── Score state ──────────────────────────────────────────────────────────────
  const clamped  = Math.max(0, Math.min(100, score));
  const level    = riskLevelColor ?? scoreToLevelColor(clamped);
  const color    = LEVEL_COLORS[level];
  const label    = LEVEL_LABELS[level];

  // ── Needle geometry ──────────────────────────────────────────────────────────
  const needleDeg = START_DEG + (clamped / 100) * SWEEP_DEG;
  const tip       = polar(needleDeg, r - sw * 0.35);
  const tail      = polar(needleDeg + 180, r * 0.17);

  const svgH = size * 0.98;

  return (
    <div className="flex flex-col items-center select-none" aria-hidden>
      <svg
        width={size}
        height={svgH}
        viewBox={`0 0 ${size} ${svgH}`}
        role="img"
        aria-label={`Risk gauge: ${clamped} out of 100 — ${label}`}
      >
        {/* ── Zone background arcs (equal thirds — visual guide) ────────────── */}
        <path d={arcPath(0, 33)}   fill="none" stroke="#16a34a" strokeWidth={sw} strokeLinecap="butt" opacity={0.22} />
        <path d={arcPath(33, 67)}  fill="none" stroke="#d97706" strokeWidth={sw} strokeLinecap="butt" opacity={0.22} />
        <path d={arcPath(67, 100)} fill="none" stroke="#dc2626" strokeWidth={sw} strokeLinecap="butt" opacity={0.22} />

        {/* ── Score fill arc ───────────────────────────────────────────────── */}
        {clamped > 0 && (
          <path
            d={arcPath(0, clamped)}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        )}

        {/* ── Zone-boundary tick marks ─────────────────────────────────────── */}
        {[0, 33, 67, 100].map(pct => {
          const tickDeg = START_DEG + (pct / 100) * SWEEP_DEG;
          const outer   = polar(tickDeg, r + sw * 0.62);
          const inner   = polar(tickDeg, r - sw * 0.62);
          return (
            <line
              key={pct}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="white"
              strokeWidth={size * 0.013}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Score label ──────────────────────────────────────────────────── */}
        <text
          x={cx}
          y={cy + r * 0.42}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: size * 0.21,
            fontWeight: 700,
            fill: color,
            fontFamily: 'var(--font-body, system-ui)',
          }}
        >
          {clamped}
        </text>
        <text
          x={cx}
          y={cy + r * 0.75}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: size * 0.063,
            fontWeight: 400,
            fill: 'var(--muted-foreground, #6b7280)',
            fontFamily: 'var(--font-body, system-ui)',
          }}
        >
          / 100
        </text>

        {/* ── Needle ───────────────────────────────────────────────────────── */}
        <line
          x1={cx} y1={cy}
          x2={tail.x} y2={tail.y}
          stroke={color}
          strokeWidth={size * 0.017}
          strokeLinecap="round"
          opacity={0.45}
        />
        <line
          x1={cx} y1={cy}
          x2={tip.x} y2={tip.y}
          stroke={color}
          strokeWidth={size * 0.017}
          strokeLinecap="round"
        />

        {/* ── Hub ──────────────────────────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={size * 0.045} fill={color} />
        <circle cx={cx} cy={cy} r={size * 0.027} fill="white" />

        {/* ── Zone end-labels ──────────────────────────────────────────────── */}
        <text
          x={polar(START_DEG - 9).x}
          y={polar(START_DEG - 9).y + 5}
          textAnchor="end"
          style={{
            fontSize: size * 0.052,
            fontWeight: 600,
            fill: '#16a34a',
            fontFamily: 'var(--font-body, system-ui)',
          }}
        >
          Low
        </text>
        <text
          x={polar(START_DEG + SWEEP_DEG + 9).x}
          y={polar(START_DEG + SWEEP_DEG + 9).y + 5}
          textAnchor="start"
          style={{
            fontSize: size * 0.052,
            fontWeight: 600,
            fill: '#dc2626',
            fontFamily: 'var(--font-body, system-ui)',
          }}
        >
          High
        </text>
      </svg>

      {/* ── Risk level pill ──────────────────────────────────────────────────── */}
      <div
        className="mt-1 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
        style={{
          background: `${color}18`,
          color,
          border: `1.5px solid ${color}40`,
        }}
      >
        {label}
      </div>
    </div>
  );
}
