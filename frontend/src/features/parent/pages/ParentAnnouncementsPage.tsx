/**
 * ParentAnnouncementsPage.tsx
 *
 * Read-only announcements view for the Applicant portal.
 * Fetches published announcements and displays them with
 * pinned/urgent indicators and paginated loading.
 *
 * Route: /parent/announcements
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Megaphone, Pin, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';

import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, staggerContainer, staggerChild } from '@/shared/constants/motion';

const PAGE_SIZE = 10;

export function ParentAnnouncementsPage() {
  const [items, setItems]       = useState<Announcement[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState(false);
  const [page, setPage]         = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const hasMore = items.length < total;

  const load = useCallback(async (_pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await getAnnouncements(PAGE_SIZE);
      if (append) {
        setItems((prev) => [...prev, ...res.data]);
      } else {
        setItems(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load, retryKey]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    void load(nextPage, true);
  }

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="p-6 max-w-3xl"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.10)' }}
        >
          <Megaphone className="h-4.5 w-4.5" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div>
          <h1
            className="font-headline text-xl font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            Announcements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Updates from the Camp Burnt Gin team
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeletons.Card key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load announcements"
          description="Check your connection and try again."
          action={{
            label: 'Retry',
            onClick: () => setRetryKey((k) => k + 1),
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No announcements yet"
          description="Check back soon for updates from the Camp Burnt Gin team."
        />
      ) : (
        <>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {items.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </motion.div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {loadingMore ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function AnnouncementCard({ item }: { item: Announcement }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.body.length > 300;
  const bodyPreview = isLong && !expanded ? item.body.slice(0, 300) + '…' : item.body;

  return (
    <motion.article
      variants={staggerChild}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: item.is_urgent
          ? 'rgba(220,38,38,0.04)'
          : item.is_pinned
            ? 'rgba(22,163,74,0.04)'
            : 'var(--card)',
        borderColor: item.is_urgent
          ? 'rgba(220,38,38,0.20)'
          : item.is_pinned
            ? 'rgba(22,163,74,0.20)'
            : 'var(--border)',
      }}
    >
      {/* Top bar for urgent/pinned */}
      {(item.is_urgent || item.is_pinned) && (
        <div
          className="px-4 py-1.5 flex items-center gap-2 text-xs font-medium border-b"
          style={{
            background: item.is_urgent
              ? 'rgba(220,38,38,0.08)'
              : 'rgba(22,163,74,0.08)',
            borderColor: item.is_urgent
              ? 'rgba(220,38,38,0.15)'
              : 'rgba(22,163,74,0.15)',
            color: item.is_urgent ? '#dc2626' : 'var(--ember-orange)',
          }}
        >
          {item.is_urgent ? (
            <><AlertTriangle className="h-3 w-3" /> Urgent</>
          ) : (
            <><Pin className="h-3 w-3" /> Pinned</>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Title + date */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2
            className="font-semibold text-base leading-snug"
            style={{ color: 'var(--foreground)' }}
          >
            {item.title}
          </h2>
          <time
            className="text-xs flex-shrink-0 mt-0.5"
            style={{ color: 'var(--muted-foreground)' }}
            dateTime={item.published_at}
          >
            {format(parseISO(item.published_at), 'MMM d, yyyy')}
          </time>
        </div>

        {/* Author */}
        {item.author && (
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            By {item.author.name}
          </p>
        )}

        {/* Body */}
        <p
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: 'var(--foreground)' }}
        >
          {bodyPreview}
        </p>

        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium mt-2 hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </motion.article>
  );
}
