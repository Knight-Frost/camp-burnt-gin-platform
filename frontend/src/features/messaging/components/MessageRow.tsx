/**
 * MessageRow.tsx
 *
 * Individual message row in the inbox list view.
 * Gmail-level interaction:
 *   - Checkbox (hidden until hover or selected)
 *   - Star/flag toggle
 *   - Sender, subject, preview, category badge, timestamp
 *   - Hover reveals action icons: Archive, Delete, More (replaces timestamp)
 *   - More menu via Popover: mark read/unread, archive, delete
 */

import { useRef, useState, type MouseEvent } from 'react';
import {
  Archive, Trash2, MoreHorizontal, Star, CheckSquare, Square,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { Popover } from '@/ui/overlay/Popover';
import type { Conversation } from '@/features/messaging/api/messaging.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

// ─── Badge helpers ────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  application:   { bg: 'rgba(22,163,74,0.12)',  color: BRAND,      label: 'Applicants'   },
  medical:       { bg: 'rgba(37,99,235,0.12)',  color: '#2563eb',  label: 'Medical Team' },
  general:       { bg: 'rgba(107,114,128,0.12)',color: '#6b7280',  label: 'System'       },
  other:         { bg: 'rgba(107,114,128,0.12)',color: '#6b7280',  label: 'System'       },
  announcements: { bg: 'rgba(245,158,11,0.12)', color: '#d97706',  label: 'Announcements'},
};

function CategoryBadge({ category }: { category?: string }) {
  const s = BADGE_STYLES[category ?? 'other'] ?? BADGE_STYLES.other;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const PALETTE = ['#16a34a','#1d4ed8','#7c3aed','#0f766e','#b45309','#be123c','#0369a1','#4338ca'];

function avatarBg(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none"
      style={{
        width: size, height: size,
        background: avatarBg(name), color: '#fff',
        fontSize: size < 32 ? 10 : 12, lineHeight: 1,
      }}
    >
      {initials(name)}
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'MMM d');
  return format(d, 'MM/dd/yy');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MessageRowProps {
  conversation: Conversation;
  isSelected: boolean;
  isStarred: boolean;
  currentUserId?: number;
  onSelect: (id: number, e: MouseEvent) => void;
  onStar: (id: number, e: MouseEvent) => void;
  onArchive: (id: number, e: MouseEvent) => void;
  onDelete: (id: number, e: MouseEvent) => void;
  onMarkRead?: (id: number) => void;
  onMarkUnread?: (id: number) => void;
  onClick: (conv: Conversation) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MessageRow({
  conversation: conv,
  isSelected,
  isStarred,
  currentUserId,
  onSelect,
  onStar,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onClick,
}: MessageRowProps) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const isUnread   = (conv.unread_count ?? 0) > 0;
  const others     = conv.participants.filter((p) => p.id !== currentUserId);
  const senderName = conv.last_message?.sender?.name ?? (others[0]?.name ?? 'Unknown');
  const preview    = conv.last_message?.body
    ? conv.last_message.body.replace(/<[^>]*>/g, '').slice(0, 90)
    : '—';
  const subject  = conv.subject ?? '(No subject)';
  const lastTime = conv.last_message?.created_at ?? conv.created_at;

  return (
    <div
      onClick={() => onClick(conv)}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group"
      style={{
        background: isSelected
          ? BRAND_T
          : isUnread ? 'rgba(22,163,74,0.03)' : 'var(--card)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLElement).style.background = 'var(--dash-nav-hover-bg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = isSelected
          ? BRAND_T : isUnread ? 'rgba(22,163,74,0.03)' : 'var(--card)';
      }}
      data-testid="message-row"
    >
      {/* Checkbox — hidden until hover or selected */}
      <button
        type="button"
        onClick={(e) => onSelect(conv.id, e)}
        className="flex-shrink-0 transition-opacity"
        style={{ opacity: isSelected ? 1 : undefined }}
        aria-label={isSelected ? 'Deselect conversation' : 'Select conversation'}
      >
        {isSelected
          ? <CheckSquare className="h-4 w-4 opacity-100" style={{ color: BRAND }} />
          : <Square className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {/* Star */}
      <button
        type="button"
        onClick={(e) => onStar(conv.id, e)}
        className="flex-shrink-0"
        aria-label={isStarred ? 'Remove star' : 'Star conversation'}
      >
        <Star
          className="h-4 w-4 transition-colors"
          style={{
            color: isStarred ? '#f59e0b' : 'var(--border)',
            fill:  isStarred ? '#f59e0b' : 'transparent',
          }}
        />
      </button>

      {/* Avatar */}
      <Avatar name={senderName} size={36} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-sm truncate"
            style={{ fontWeight: isUnread ? 700 : 500, color: 'var(--foreground)' }}
          >
            {senderName}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-sm truncate flex-shrink-0 max-w-[40%]"
            style={{ fontWeight: isUnread ? 600 : 400, color: 'var(--foreground)' }}
          >
            {subject}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            — {preview}
          </span>
        </div>
      </div>

      {/* Right side: badge + (timestamp/dot or action icons) */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <CategoryBadge category={conv.category} />

        {/* Timestamp + unread dot — hidden on hover */}
        <div className="relative flex items-center gap-2.5">
          <div className="flex items-center gap-2.5 group-hover:opacity-0 transition-opacity duration-150">
            <time
              className="text-xs w-14 text-right tabular-nums"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {relativeTime(lastTime)}
            </time>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: isUnread ? BRAND : 'transparent' }}
            />
          </div>

          {/* Action icons — visible on hover */}
          <div
            className="absolute right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => onArchive(conv.id, e)}
              title="Archive"
              aria-label="Archive conversation"
              className="p-1 rounded transition-colors hover:bg-[var(--border)]"
              style={{ color: 'var(--muted-foreground)' }}
              data-testid="row-archive-btn"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => onDelete(conv.id, e)}
              title="Delete"
              aria-label="Delete conversation"
              className="p-1 rounded transition-colors hover:bg-[var(--border)]"
              style={{ color: 'var(--muted-foreground)' }}
              data-testid="row-delete-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              ref={moreButtonRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}
              title="More options"
              aria-label="More options"
              className="p-1 rounded transition-colors hover:bg-[var(--border)]"
              style={{ color: 'var(--muted-foreground)' }}
              data-testid="row-more-btn"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* More menu popover */}
      <Popover
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        anchorRef={moreButtonRef}
        placement="bottom-right"
      >
        <div className="py-1 min-w-[168px]">
          {isUnread ? (
            <button
              type="button"
              onClick={() => { onMarkRead?.(conv.id); setMoreOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--foreground)' }}
            >
              Mark as read
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { onMarkUnread?.(conv.id); setMoreOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--foreground)' }}
            >
              Mark as unread
            </button>
          )}
          <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
          <button
            type="button"
            onClick={(e) => { onArchive(conv.id, e); setMoreOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--foreground)' }}
          >
            Archive
          </button>
          <button
            type="button"
            onClick={(e) => { onDelete(conv.id, e); setMoreOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--destructive)' }}
          >
            Delete
          </button>
        </div>
      </Popover>
    </div>
  );
}
