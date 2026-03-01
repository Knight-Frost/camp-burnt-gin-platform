/**
 * InboxPage.tsx
 *
 * Orchestration layer — uses extracted components.
 * InboxPage is responsible for state, data fetching, and routing between views.
 * All visual sub-components live in features/messaging/components/.
 *
 *   - Bootstrap stability gate: skeleton until auth resolved + data loaded
 *   - AnimatePresence mode="wait": opacity crossfade between list and thread views
 *   - Keyboard shortcuts: c = compose, / = focus search, Esc = close compose
 *   - Scroll restoration: saves/restores list scroll position when opening/closing threads
 *   - MessageRow: extracted component with Gmail hover-reveal actions
 *
 * Route: /parent/inbox  /admin/inbox  /super-admin/inbox
 */

import {
  useState, useEffect, useRef, useCallback, type ElementType, type MouseEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search, Plus, RefreshCw, Archive, ArchiveRestore, Star, Trash2,
  MailOpen, X, ChevronDown, CheckSquare, Square, Bot,
} from 'lucide-react';

import {
  getConversations, archiveConversation, unarchiveConversation, leaveConversation, deleteConversation,
  type Conversation,
} from '@/features/messaging/api/messaging.api';
import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import { format } from 'date-fns';
import { Megaphone, Pin, AlertTriangle } from 'lucide-react';
import { Skeletons } from '@/ui/components/Skeletons';
import { useAppSelector } from '@/store/hooks';
import { useBootstrapReady } from '@/shared/hooks/useBootstrapReady';
import { MessageRow } from '@/features/messaging/components/MessageRow';
import { ThreadView } from '@/features/messaging/components/ThreadView';
import { FloatingCompose } from '@/features/messaging/components/FloatingCompose';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'application' | 'medical' | 'system' | 'announcements' | 'archive';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',           label: 'All' },
  { id: 'application',   label: 'Applicants' },
  { id: 'medical',       label: 'Medical Team' },
  { id: 'system',        label: 'System' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'archive',       label: 'Archive' },
];

// ─── Starred persistence ──────────────────────────────────────────────────────

const STARRED_KEY = 'inbox_starred_ids';
function loadStarred(): Set<number> {
  try { return new Set<number>(JSON.parse(localStorage.getItem(STARRED_KEY) ?? '[]') as number[]); }
  catch { return new Set(); }
}
function saveStarred(ids: Set<number>) {
  try { localStorage.setItem(STARRED_KEY, JSON.stringify([...ids])); } catch { /**/ }
}

// ─── View crossfade variants ──────────────────────────────────────────────────

const viewVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeInOut' as const } },
  exit:    { opacity: 0, transition: { duration: 0.15, ease: 'easeInOut' as const } },
};

// ─── BulkButton helper ────────────────────────────────────────────────────────

function BulkButton({
  icon: Icon, title, onClick,
}: { icon: ElementType; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
    >
      <Icon className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
    </button>
  );
}

// ─── InboxPage ────────────────────────────────────────────────────────────────

export function InboxPage() {
  // Bootstrap stability gate — prevents premature empty state on auth rehydration
  const bootstrapReady = useBootstrapReady();
  const currentUserId  = useAppSelector((s) => s.auth.user?.id);
  // Role-aware: super_admin and admin can hard-delete conversations
  const userRoleName   = useAppSelector((s) => {
    const u = s.auth.user;
    return u?.roles?.[0]?.name ?? (typeof u?.role === 'string' ? u.role : '') ?? '';
  });
  const isAdmin = ['admin', 'super_admin'].includes(userRoleName);

  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(false);
  const [activeTab, setActiveTab]               = useState<FilterTab>('all');
  const [announcements, setAnnouncements]       = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnounceLoad] = useState(false);
  const [announcementsError, setAnnounceError]  = useState(false);
  const [archivedConvs, setArchivedConvs]       = useState<Conversation[]>([]);
  const [archivedLoading, setArchiveLoad]       = useState(false);
  const [archivedError, setArchiveError]        = useState(false);
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [starred, setStarred]             = useState<Set<number>>(loadStarred);
  const [selectedConv, setSelectedConv]   = useState<Conversation | null>(null);
  const [showCompose, setShowCompose]     = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);

  // Scroll restoration
  const listScrollRef  = useRef<HTMLDivElement>(null);
  const savedScrollPos = useRef(0);

  // Keyboard shortcut targets
  const searchRef = useRef<HTMLInputElement>(null);

  // Per-tab fetch keys — track which refreshKey we last fetched at.
  // Prevents re-fetching cached data when switching back to a tab that already loaded.
  // Value of -1 means "never fetched"; matches refreshKey once data has been loaded.
  const announcementsFetchKey = useRef<number>(-1);
  const archiveFetchKey       = useRef<number>(-1);

  // isDataLoading: true until BOTH bootstrap ready AND data fetched
  const isDataLoading = !bootstrapReady || (activeTab === 'archive' ? archivedLoading : loading);
  const hasError      = activeTab === 'archive' ? archivedError : error;

  // ─── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getConversations();
      setConversations(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bootstrapReady) return;
    void load();
  }, [load, refreshKey, bootstrapReady]);

  // Fetch announcements — only on first visit per refreshKey cycle.
  // Skips re-fetch when switching back to a tab that already has data.
  useEffect(() => {
    if (!bootstrapReady || activeTab !== 'announcements') return;
    if (announcementsFetchKey.current === refreshKey) return; // already cached
    announcementsFetchKey.current = refreshKey;
    setAnnounceLoad(true);
    setAnnounceError(false);
    getAnnouncements(20)
      .then((res) => setAnnouncements(res.data))
      .catch(() => setAnnounceError(true))
      .finally(() => setAnnounceLoad(false));
  }, [activeTab, bootstrapReady, refreshKey]);

  // Fetch archived conversations — only on first visit per refreshKey cycle.
  useEffect(() => {
    if (!bootstrapReady || activeTab !== 'archive') return;
    if (archiveFetchKey.current === refreshKey) return; // already cached
    archiveFetchKey.current = refreshKey;
    setArchiveLoad(true);
    setArchiveError(false);
    getConversations({ include_archived: true })
      .then((res) => setArchivedConvs(res.data.filter((c) => c.archived_at !== null)))
      .catch(() => setArchiveError(true))
      .finally(() => setArchiveLoad(false));
  }, [activeTab, bootstrapReady, refreshKey]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (showCompose) setShowCompose(false);
        return;
      }
      if (inInput) return;
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowCompose(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCompose]);

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const sourceList = activeTab === 'archive' ? archivedConvs : conversations;
  const filtered = sourceList.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSubject = c.subject?.toLowerCase().includes(q);
      const matchSender  = c.last_message?.sender?.name.toLowerCase().includes(q);
      const matchBody    = c.last_message?.body.toLowerCase().includes(q);
      if (!matchSubject && !matchSender && !matchBody) return false;
    }
    switch (activeTab) {
      case 'application':   return c.category === 'application' && !c.is_system_generated;
      case 'medical':       return c.category === 'medical' && !c.is_system_generated;
      case 'system':        return c.is_system_generated === true;
      case 'announcements': return false;
      case 'archive':       return true; // archivedConvs already pre-filtered
      default:              return !c.is_system_generated; // 'all' shows only user conversations
    }
  });

  function unreadForTab(tab: FilterTab): number {
    if (tab === 'announcements' || tab === 'archive') return 0;
    return conversations.filter((c) => {
      if (!c.unread_count) return false;
      switch (tab) {
        case 'application': return c.category === 'application' && !c.is_system_generated;
        case 'medical':     return c.category === 'medical' && !c.is_system_generated;
        case 'system':      return c.is_system_generated === true;
        default:            return !c.is_system_generated;
      }
    }).reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
  }

  // ─── Tab switching ─────────────────────────────────────────────────────────

  function handleTabChange(tab: FilterTab) {
    // Pre-set loading flags in the same React 18 batch as setActiveTab.
    // Without this, the first render after a tab switch would see the new activeTab
    // but the old (false) loading flag, producing a 1-frame flash of empty state
    // before the useEffect fires to set loading=true.
    //
    // Only pre-set when data hasn't been fetched yet for this refreshKey cycle.
    // If data is already cached, we skip this so the cached content shows instantly.
    if (tab === 'announcements' && announcementsFetchKey.current !== refreshKey) {
      setAnnounceLoad(true);
    }
    if (tab === 'archive' && archiveFetchKey.current !== refreshKey) {
      setArchiveLoad(true);
    }
    setSelected(new Set()); // Clear stale selection when switching tabs
    setActiveTab(tab);
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  function toggleStar(id: number, e: MouseEvent) {
    e.stopPropagation();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveStarred(next);
      return next;
    });
  }

  function toggleSelect(id: number, e: MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  // ─── Row-level actions ─────────────────────────────────────────────────────

  function handleRowArchive(id: number, e: MouseEvent) {
    e.stopPropagation();
    if (activeTab === 'archive') {
      unarchiveConversation(id)
        .then(() => {
          setArchivedConvs((prev) => prev.filter((c) => c.id !== id));
          toast.success('Conversation restored to inbox.');
        })
        .catch(() => toast.error('Restore failed.'));
    } else {
      archiveConversation(id)
        .then(() => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          toast.success('Conversation archived.');
        })
        .catch(() => toast.error('Archive failed.'));
    }
  }

  function handleRowDelete(id: number, e: MouseEvent) {
    e.stopPropagation();
    const action = isAdmin ? deleteConversation(id) : leaveConversation(id);
    action
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        toast.success(isAdmin ? 'Conversation deleted.' : 'Conversation removed.');
      })
      .catch(() => toast.error('Delete failed.'));
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────

  async function handleBulkArchive() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => archiveConversation(id)));
      setConversations((prev) =>
        prev.map((c) => ids.includes(c.id) ? { ...c, archived_at: new Date().toISOString() } : c)
      );
      setSelected(new Set());
      toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} archived.`);
    } catch {
      toast.error('Archive failed.');
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => isAdmin ? deleteConversation(id) : leaveConversation(id)));
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());
      toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} ${isAdmin ? 'deleted' : 'removed'}.`);
    } catch {
      toast.error('Delete failed.');
    }
  }

  async function handleBulkRestore() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => unarchiveConversation(id)));
      setArchivedConvs((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());
      toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} restored.`);
    } catch {
      toast.error('Restore failed.');
    }
  }

  // ─── Conversation navigation ───────────────────────────────────────────────

  function openConversation(conv: Conversation) {
    savedScrollPos.current = listScrollRef.current?.scrollTop ?? 0;
    setSelectedConv(conv);
  }

  function handleBack() {
    setSelectedConv(null);
    requestAnimationFrame(() => {
      if (listScrollRef.current) {
        listScrollRef.current.scrollTop = savedScrollPos.current;
      }
    });
  }

  function handleConvArchived(id: number) {
    if (activeTab === 'archive') {
      setArchivedConvs((prev) => prev.filter((c) => c.id !== id));
    } else {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
    handleBack();
  }

  function handleConvCreated(conv: Conversation) {
    setConversations((prev) => [conv, ...prev]);
    setShowCompose(false);
    openConversation(conv);
  }

  const allSelected  = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;
  // System tab is read-only — no toolbar, compose, archive, or delete actions
  const isSystemTab  = activeTab === 'system';
  const showToolbar  = !isDataLoading && !hasError && filtered.length > 0 && activeTab !== 'announcements' && !isSystemTab;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AnimatePresence mode="wait">

        {/* ── Thread view ────────────────────────────────────────────────────── */}
        {selectedConv ? (
          <motion.div key="thread" {...viewVariants} className="flex flex-col h-full overflow-hidden">
            <ThreadView
              conversation={selectedConv}
              currentUserId={currentUserId}
              onBack={handleBack}
              onArchive={handleConvArchived}
            />
          </motion.div>

        ) : (

          /* ── List view ───────────────────────────────────────────────────── */
          <motion.div key="list" {...viewVariants} className="flex flex-col h-full overflow-hidden">
            <div ref={listScrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-5">

                {/* ── Row 1: Title + Search + Compose ── */}
                <div className="flex items-center gap-3">
                  <h1 className="font-headline text-2xl font-bold flex-shrink-0" style={{ color: 'var(--foreground)' }}>
                    Inbox
                  </h1>
                  <div
                    className="flex items-center gap-2 flex-1 rounded-xl px-3.5 py-2.5 border"
                    style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
                  >
                    <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search conversations…  (/)"
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: 'var(--foreground)' }}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="flex-shrink-0" aria-label="Clear search">
                        <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      </button>
                    )}
                  </div>
                  {!isSystemTab && (
                    <button
                      onClick={() => setShowCompose(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-90"
                      style={{ background: BRAND }}
                      title="Compose (c)"
                      aria-label="Compose new message"
                    >
                      <Plus className="h-4 w-4" />
                      Compose
                    </button>
                  )}
                </div>

                {/* ── Row 2: Message panel ── */}
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                >

                  {/* ── Tabs row ── */}
                  <div
                    className="flex items-center border-b"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                  >
                    <div className="flex items-center flex-1 px-2">
                      {TABS.map((tab) => {
                        const count  = unreadForTab(tab.id);
                        const active = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className="relative flex items-center gap-1.5 px-3 py-3 text-sm transition-colors flex-shrink-0 select-none"
                            style={{
                              fontWeight: active ? 600 : 400,
                              color: active ? BRAND : 'var(--muted-foreground)',
                              borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent',
                              marginBottom: -1,
                            }}
                          >
                            {tab.label}
                            {count > 0 && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none"
                                style={{
                                  background: active ? BRAND : 'rgba(107,114,128,0.14)',
                                  color: active ? '#fff' : '#6b7280',
                                  fontSize: 10,
                                }}
                              >
                                {count > 99 ? '99+' : count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {showToolbar && (
                      <div className="flex items-center pr-3">
                        <button
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          Newest <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Toolbar ── */}
                  {showToolbar && (
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 border-b"
                      style={{
                        borderColor: 'var(--border)',
                        background: someSelected ? BRAND_T : 'rgba(248,249,250,0.6)',
                      }}
                    >
                      {/* Select-all */}
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 rounded transition-colors flex-shrink-0 hover:bg-[var(--dash-nav-hover-bg)]"
                        title={allSelected ? 'Deselect all' : 'Select all'}
                        aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allSelected
                          ? <CheckSquare className="h-4 w-4" style={{ color: BRAND }} />
                          : <Square className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                        }
                      </button>

                      {someSelected ? (
                        <>
                          <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                            {selected.size} selected
                          </span>
                          {/* Clear selection */}
                          <button
                            type="button"
                            onClick={() => setSelected(new Set())}
                            title="Clear selection"
                            aria-label="Clear selection"
                            className="p-1 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          >
                            <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                          </button>
                          <div className="flex items-center gap-0.5">
                            <BulkButton icon={MailOpen} title="Mark as read"  onClick={() => setSelected(new Set())} />
                            {activeTab === 'archive'
                              ? <BulkButton icon={ArchiveRestore} title="Restore to inbox" onClick={() => void handleBulkRestore()} />
                              : <BulkButton icon={Archive}        title="Archive"           onClick={() => void handleBulkArchive()} />
                            }
                            <BulkButton icon={Trash2}   title="Delete"        onClick={() => void handleBulkDelete()} />
                            <BulkButton icon={Star}     title="Star"          onClick={() => {
                              setStarred((prev) => {
                                const next = new Set(prev);
                                selected.forEach((id) => next.add(id));
                                saveStarred(next);
                                return next;
                              });
                            }} />
                          </div>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
                        </span>
                      )}

                      <div className="ml-auto">
                        <button
                          onClick={() => setRefreshKey((k) => k + 1)}
                          title="Refresh"
                          aria-label="Refresh inbox"
                          className="p-1.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                            style={{ color: 'var(--muted-foreground)' }}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Content area — stable min-height prevents layout shift ── */}
                  <div className="min-h-[360px] flex flex-col">

                    {/* ── Announcements tab — read-only broadcast list ── */}
                    {activeTab === 'announcements' ? (
                      announcementsLoading ? (
                        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Row key={i} />)}
                        </div>
                      ) : announcementsError ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-16">
                          <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                            Could not load announcements
                          </p>
                          <button
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                            style={{ color: BRAND }}
                          >
                            Try again
                          </button>
                        </div>
                      ) : announcements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-16 px-8">
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                            style={{ background: 'rgba(107,114,128,0.08)' }}
                          >
                            <Megaphone className="h-7 w-7" style={{ color: 'var(--muted-foreground)' }} />
                          </div>
                          <p className="text-sm font-semibold mb-2 text-center" style={{ color: 'var(--foreground)' }}>
                            No announcements yet
                          </p>
                          <p className="text-sm text-center max-w-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                            Broadcast messages from staff will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                          {announcements.map((ann) => (
                            <div
                              key={ann.id}
                              className="px-4 py-3.5 flex flex-col gap-1.5"
                              style={{ background: ann.is_urgent ? 'rgba(239,68,68,0.04)' : undefined }}
                            >
                              <div className="flex items-start gap-2 flex-wrap">
                                {ann.is_pinned && (
                                  <Pin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
                                )}
                                {ann.is_urgent && (
                                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
                                )}
                                <p className="text-sm font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
                                  {ann.title}
                                </p>
                                <time className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                                  {format(new Date(ann.published_at ?? ann.created_at), 'MMM d, h:mm a')}
                                </time>
                              </div>
                              <p
                                className="text-sm leading-relaxed line-clamp-3"
                                style={{ color: 'var(--muted-foreground)' }}
                                // Announcement body from our own server — sanitized at API layer
                                dangerouslySetInnerHTML={{ __html: ann.body }}
                              />
                              {ann.author && (
                                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  From {ann.author.name}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )

                    ) : isDataLoading ? (
                      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                        {Array.from({ length: 6 }).map((_, i) => <Skeletons.Row key={i} />)}
                      </div>

                    ) : hasError ? (
                      <div className="flex flex-col items-center justify-center flex-1 py-16">
                        <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                          Could not load messages
                        </p>
                        <button
                          onClick={() => setRefreshKey((k) => k + 1)}
                          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          style={{ color: BRAND }}
                        >
                          Try again
                        </button>
                      </div>

                    ) : filtered.length === 0 ? (
                      /* Empty state — only shown when load is fully complete and there are genuinely no results */
                      <div className="flex flex-col items-center justify-center flex-1 py-16 px-8">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                          style={{ background: 'rgba(107,114,128,0.08)' }}
                        >
                          {activeTab === 'archive'
                            ? <Archive className="h-7 w-7" style={{ color: 'var(--muted-foreground)' }} />
                            : activeTab === 'system'
                              ? <Bot className="h-7 w-7" style={{ color: 'var(--muted-foreground)' }} />
                              : <MailOpen className="h-7 w-7" style={{ color: 'var(--muted-foreground)' }} />
                          }
                        </div>
                        <p className="text-sm font-semibold mb-2 text-center" style={{ color: 'var(--foreground)' }}>
                          {search
                            ? 'No results found'
                            : activeTab === 'archive'
                              ? 'No archived conversations'
                              : activeTab === 'system'
                                ? 'No system notifications'
                                : 'Your inbox is clear'}
                        </p>
                        <p className="text-sm text-center max-w-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                          {search
                            ? 'Try adjusting your search term or switching tabs.'
                            : activeTab === 'archive'
                              ? 'Conversations you archive will appear here.'
                              : activeTab === 'system'
                                ? 'Automated notifications from the platform will appear here.'
                                : 'New conversations will appear here when someone messages you.'}
                        </p>
                      </div>

                    ) : (
                      /* Message list — uses extracted MessageRow component */
                      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                        {filtered.map((conv) => (
                          <MessageRow
                            key={conv.id}
                            conversation={conv}
                            isSelected={selected.has(conv.id)}
                            isStarred={starred.has(conv.id)}
                            currentUserId={currentUserId}
                            onSelect={toggleSelect}
                            onStar={toggleStar}
                            onArchive={handleRowArchive}
                            onDelete={handleRowDelete}
                            onClick={openConversation}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating compose overlay — always available regardless of view */}
      <AnimatePresence>
        {showCompose && (
          <FloatingCompose
            onClose={() => setShowCompose(false)}
            onCreated={handleConvCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
