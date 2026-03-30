/**
 * AuthCard.tsx
 * Wooden sign card container for all authentication pages.
 * Dark walnut outer frame, light maple inner panel, recessed-panel depth.
 */

import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  /** Honey accent bar rendered beneath the title (register page) */
  accentBar?: boolean;
  children: ReactNode;
  /** Footer links rendered inside the card below a divider */
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/* ── Wood grain backgrounds ──────────────────────────────────────────────── */

// Dark walnut frame: near-horizontal grain lines over a rich brown base
const WALNUT_FRAME = [
  // Fine grain lines
  'repeating-linear-gradient(91.5deg, transparent 0, transparent 2px, rgba(15,6,1,0.18) 2px, rgba(15,6,1,0.18) 3px, transparent 3px, transparent 6px, rgba(35,15,4,0.10) 6px, rgba(35,15,4,0.10) 7px)',
  // Coarser rings
  'repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(20,8,2,0.06) 18px, rgba(20,8,2,0.06) 19px)',
  // Base walnut gradient — warm mahogany-brown
  'linear-gradient(177deg, #8f5d2c 0%, #6b3f18 20%, #7c4c22 42%, #5a2f0e 62%, #7a4820 83%, #8f5d2c 100%)',
].join(', ');

// Light maple panel: subtler grain, warm honey tones
const MAPLE_PANEL = [
  // Fine grain
  'repeating-linear-gradient(90.5deg, transparent 0, transparent 4px, rgba(100,58,12,0.065) 4px, rgba(100,58,12,0.065) 5px, transparent 5px, transparent 12px, rgba(75,42,8,0.04) 12px, rgba(75,42,8,0.04) 13px)',
  // Occasional wider ring
  'repeating-linear-gradient(89.2deg, transparent 0, transparent 22px, rgba(110,65,14,0.03) 22px, rgba(110,65,14,0.03) 23px)',
  // Subtle warm wash across the board
  'linear-gradient(175deg, rgba(255,220,140,0.10) 0%, transparent 40%, rgba(200,140,60,0.08) 100%)',
  // Base maple — light honey/amber
  'linear-gradient(180deg, #edd9a8 0%, #e4cc92 28%, #d8be80 56%, #e2ca90 80%, #eed8a4 100%)',
].join(', ');

export function AuthCard({
  title,
  subtitle,
  accentBar,
  children,
  footer,
  maxWidth = 'md',
}: AuthCardProps) {
  return (
    <div className={`w-full ${maxWidthMap[maxWidth]} auth-wood-card`}>

      {/* ── Walnut outer frame ──────────────────────────────────────────── */}
      <div
        style={{
          background:   WALNUT_FRAME,
          borderRadius: '20px',
          padding:      '14px',
          // Deep floating shadow + top-edge light bevel + bottom-edge dark bevel
          boxShadow: [
            '0 24px 80px rgba(0,0,0,0.58)',
            '0 8px 24px rgba(0,0,0,0.38)',
            '0 2px 6px rgba(0,0,0,0.28)',
            'inset 0 1px 0 rgba(222,162,72,0.55)',
            'inset 0 -2px 0 rgba(12,5,1,0.65)',
          ].join(', '),
        }}
      >

        {/* ── Maple inner panel ─────────────────────────────────────────── */}
        <div
          style={{
            background:   MAPLE_PANEL,
            borderRadius: '8px',
            padding:      '36px 40px',
            // Inset shadow creates the recessed-panel-in-frame illusion
            boxShadow: [
              'inset 0 3px 10px rgba(50,24,6,0.30)',
              'inset 0 1px 3px rgba(50,24,6,0.18)',
              '0 1px 0 rgba(222,162,72,0.25)',
            ].join(', '),
          }}
        >

          {/* Card header */}
          <div className="mb-8">
            <h1
              className="font-bold leading-tight"
              style={{
                fontSize:   '2rem',
                color:      '#166534',
                // Subtle embossed look — light highlight above, dark shadow below
                textShadow: '0 1px 0 rgba(255,220,140,0.6), 0 -1px 0 rgba(20,8,2,0.15)',
              }}
            >
              {title}
            </h1>
            {accentBar && (
              <div
                className="w-16 rounded-full mt-2.5 mb-4"
                style={{ height: '3px', background: '#c87820' }}
              />
            )}
            {subtitle && (
              <p
                className="leading-relaxed mt-2"
                style={{ fontSize: '1rem', color: '#7a5c38' }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Page-specific content */}
          {children}

          {/* Footer links — inside card with divider */}
          {footer && (
            <div className="mt-7">
              <hr style={{ borderColor: 'rgba(140,88,30,0.28)' }} />
              <div
                className="mt-5 text-center"
                style={{ fontSize: '0.9375rem', color: '#7a6040' }}
              >
                {footer}
              </div>
            </div>
          )}

        </div>{/* /maple panel */}
      </div>{/* /walnut frame */}

    </div>
  );
}
