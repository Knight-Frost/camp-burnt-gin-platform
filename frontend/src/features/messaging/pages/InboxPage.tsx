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
  Search, Plus, RefreshCw, Archive, Star, Trash2,
  MailOpen, X, ChevronDown, CheckSquare, Square,
} from 'lucide-react';

import {
  getConversations, archiveConversation, leaveConversation,
  type Conversation,
} from '@/features/messaging/api/messaging.api';
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

type FilterTab = 'all' | 'application' | 'medical' | 'system' | 'announcements';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',           label: 'All' },
  { id: 'application',   label: 'Applicants' },
  { id: 'medical',       label: 'Medical Team' },
  { id: 'system',        label: 'System' },
  { id: 'announcements', label: 'Announcements' },
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [activeTab, setActiveTab]         = useState<FilterTab>('all');
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

  // isDataLoading: true until BOTH bootstrap ready AND data fetched
  const isDataLoading = !bootstrapReady || loading;

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

  const filtered = conversations.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSubject = c.subject?.toLowerCase().includes(q);
      const matchSender  = c.last_message?.sender?.name.toLowerCase().includes(q);
      const matchBody    = c.last_message?.body.toLowerCase().includes(q);
      if (!matchSubject && !matchSender && !matchBody) return false;
    }
    switch (activeTab) {
      case 'application':   return c.category === 'application';
      case 'medical':       return c.category === 'medical';
      case 'system':        return c.category === 'general' || c.category === 'other';
      case 'announcements': return false;
      default:              return true;
    }
  });

  function unreadForTab(tab: FilterTab): number {
    return conversations.filter((c) => {
      if (!c.unread_count) return false;
      switch (tab) {
        case 'application':   return c.category === 'application';
        case 'medical':       return c.category === 'medical';
        case 'system':        return c.category === 'general' || c.category === 'other';
        case 'announcements': return false;
        default:              return true;
      }
    }).reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
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
    archiveConversation(id)
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        toast.success('Conversation archived.');
      })
      .catch(() => toast.error('Archive failed.'));
  }

  function handleRowDelete(id: number, e: MouseEvent) {
    e.stopPropagation();
    leaveConversation(id)
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        toast.success('Conversation removed.');
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
      await Promise.all(ids.map((id) => leaveConversation(id)));
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());
      toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} removed.`);
    } catch {
      toast.error('Delete failed.');
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
    setConversations((prev) => prev.filter((c) => c.id !== id));
    handleBack();
  }

  function handleConvCreated(conv: Conversation) {
    setConversations((prev) => [conv, ...prev]);
    setShowCompose(false);
    openConversation(conv);
  }

  const allSelected  = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;
  const showToolbar  = !isDataLoading && !error && filtered.length > 0;

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
                            onClick={() => setActiveTab(tab.id)}
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
                            <BulkButton icon={Archive}  title="Archive"       onClick={() => void handleBulkArchive()} />
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

                    {isDataLoading ? (
                      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                        {Array.from({ length: 6 }).map((_, i) => <Skeletons.Row key={i} />)}
                      </div>

                    ) : error ? (
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
                          <MailOpen className="h-7 w-7" style={{ color: 'var(--muted-foreground)' }} />
                        </div>
                        <p className="text-sm font-semibold mb-2 text-center" style={{ color: 'var(--foreground)' }}>
                          {search ? 'No results found' : 'Your inbox is clear'}
                        </p>
                        <p className="text-sm text-center max-w-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                          {search
                            ? 'Try adjusting your search term or switching tabs.'
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
