/**
 * InboxPage.tsx
 *
 * Gmail-style inbox with full sidebar navigation, starred conversations,
 * PHI badges for medical threads, and threaded message view.
 *
 * Layout:
 *   Left panel (340px) — Sidebar nav + search + thread list
 *   Right panel (flex) — Message thread or empty state
 *   Floating compose  — Bottom-right, minimizable
 */

import { useState, useEffect, useRef, useCallback, type MouseEvent, type ElementType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Send, ArrowLeft, Archive, X, Search, Minus,
  MessageSquare, RefreshCw, Plus, Star, Inbox,
  PaperclipIcon, Lock, ChevronDown, ChevronRight,
  MailOpen, ArchiveX, Maximize2, Minimize2,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

import {
  getConversations, getMessages, sendMessage,
  createConversation, archiveConversation, unarchiveConversation, searchInboxUsers,
  type Conversation, type Message, type ConversationParticipant, type MessageCategory,
  type NewConversationPayload,
} from '@/features/messaging/api/messaging.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { useAppSelector } from '@/store/hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';  // lighter emerald (was #16a34a)
const BRAND_T = 'rgba(22,163,74,0.10)';

// ─── Folder types ─────────────────────────────────────────────────────────────

type PrimaryFolder  = 'inbox' | 'starred' | 'sent' | 'archive';
type CategoryFolder = 'general' | 'medical' | 'application' | 'other';
type FolderView     = PrimaryFolder | CategoryFolder;

// ─── Starred persistence ──────────────────────────────────────────────────────

const STARRED_KEY = 'inbox_starred_ids';

function loadStarred(): Set<number> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    return new Set<number>(raw ? (JSON.parse(raw) as number[]) : []);
  } catch { return new Set(); }
}
function saveStarred(ids: Set<number>): void {
  try { localStorage.setItem(STARRED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = 'inbox_compose_draft';
interface Draft { subject: string; body: string }

function saveDraft(d: Draft)  { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
function loadDraft(): Draft | null { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null; } catch { return null; } }
function clearDraft()         { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const PALETTE = [
  '#16a34a', '#1d4ed8', '#7c3aed', '#0f766e', '#b45309',
  '#be123c', '#0369a1', '#4338ca', '#0d9488', '#9f1239',
];

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
      style={{ width: size, height: size, background: avatarBg(name), color: '#fff', fontSize: size <= 28 ? 10 : size <= 36 ? 11 : 13, lineHeight: 1 }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function threadTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'MMM d');
  return format(d, 'MM/dd/yy');
}

function groupByDay(msgs: Message[]): { label: string; msgs: Message[] }[] {
  const g: Record<string, Message[]> = {};
  for (const m of msgs) {
    const d = new Date(m.created_at);
    const k = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
    (g[k] ??= []).push(m);
  }
  return Object.entries(g).map(([label, msgs]) => ({ label, msgs }));
}

// ─── PHI Badge ────────────────────────────────────────────────────────────────

function PhiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
      style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
      title="Protected Health Information"
    >
      <Lock className="h-2.5 w-2.5" />
      PHI
    </span>
  );
}

// ─── FolderNav ────────────────────────────────────────────────────────────────

interface FolderNavProps {
  folder:        FolderView;
  onSelect:      (f: FolderView) => void;
  inboxCount:    number;
  starredCount:  number;
  categoryCounts: Record<string, number>;
  labelsOpen:    boolean;
  onToggleLabels: () => void;
}

function FolderNav({ folder, onSelect, inboxCount, starredCount, categoryCounts, labelsOpen, onToggleLabels }: FolderNavProps) {
  function NavItem({ id, icon: Icon, label, count, phi }: {
    id: FolderView; icon: ElementType; label: string; count?: number; phi?: boolean;
  }) {
    const active = folder === id;
    return (
      <button
        onClick={() => onSelect(id)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all text-left"
        style={{
          background: active ? BRAND_T : 'transparent',
          color: active ? BRAND : 'var(--muted-foreground)',
          fontWeight: active ? 600 : 400,
        }}
      >
        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: active ? BRAND : 'var(--muted-foreground)' }} />
        <span className="flex-1 truncate">{label}</span>
        {phi && <Lock className="h-3 w-3 flex-shrink-0" style={{ color: '#dc2626' }} />}
        {typeof count === 'number' && count > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{
              background: active ? BRAND : 'rgba(107,114,128,0.12)',
              color: active ? '#fff' : 'var(--muted-foreground)',
              fontSize: '10px',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="px-2 py-2 space-y-0.5">
      {/* Primary folders */}
      <NavItem id="inbox"   icon={Inbox}    label="Inbox"   count={inboxCount} />
      <NavItem id="starred" icon={Star}     label="Starred" count={starredCount} />
      <NavItem id="sent"    icon={Send}     label="Sent" />
      <NavItem id="archive" icon={Archive}  label="Archive" />

      {/* Divider + Labels toggle */}
      <div className="pt-1 pb-0.5">
        <button
          onClick={onToggleLabels}
          className="w-full flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {labelsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Labels
        </button>
      </div>

      {/* Category folders */}
      {labelsOpen && (
        <div className="space-y-0.5 pl-1">
          <NavItem id="general"     icon={MessageSquare} label="General"     count={categoryCounts.general} />
          <NavItem id="medical"     icon={Lock}          label="Medical"     count={categoryCounts.medical} phi />
          <NavItem id="application" icon={PaperclipIcon} label="Application" count={categoryCounts.application} />
          <NavItem id="other"       icon={MailOpen}      label="Other"       count={categoryCounts.other} />
        </div>
      )}
    </div>
  );
}

// ─── FloatingCompose ──────────────────────────────────────────────────────────

interface FloatingComposeProps {
  onClose:   () => void;
  onCreated: (c: Conversation) => void;
}

function FloatingCompose({ onClose, onCreated }: FloatingComposeProps) {
  const [minimized, setMinimized]           = useState(false);
  const [maximized, setMaximized]           = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [recipients, setRecipients]         = useState<ConversationParticipant[]>([]);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [searchResults, setSearchResults]   = useState<ConversationParticipant[]>([]);
  const [searching, setSearching]           = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [subject, setSubject]               = useState('');
  const [body, setBody]                     = useState('');
  const [category, setCategory]             = useState<MessageCategory>('general');
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const d = loadDraft();
    if (d) { setSubject(d.subject); setBody(d.body); }
  }, []);

  useEffect(() => { saveDraft({ subject, body }); }, [subject, body]);

  useEffect(() => {
    if (!minimized) setTimeout(() => bodyRef.current?.focus(), 120);
  }, [minimized]);

  function handleRecipientInput(val: string) {
    setRecipientQuery(val);
    setShowDropdown(true);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchRef.current = setTimeout(() => {
      setSearching(true);
      searchInboxUsers(val)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }

  function addRecipient(user: ConversationParticipant) {
    if (!recipients.find((r) => r.id === user.id)) setRecipients((p) => [...p, user]);
    setRecipientQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  async function handleSend() {
    if (!body.trim()) return;
    if (recipients.length === 0) { toast.error('Please add at least one recipient.'); return; }
    setSaving(true);
    try {
      const payload: NewConversationPayload = {
        participant_ids: recipients.map((r) => r.id),
        category,
      };
      if (subject.trim()) payload.subject = subject.trim();
      const conv = await createConversation(payload);
      await sendMessage(conv.id, body.trim());
      clearDraft();
      onCreated(conv);
      toast.success('Message sent.');
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={maximized
        ? 'fixed inset-4 z-50 rounded-xl border overflow-hidden shadow-2xl'
        : 'fixed bottom-0 right-8 z-50 rounded-t-xl border overflow-hidden shadow-2xl'}
      style={{
        width: maximized ? undefined : 424,
        background: '#ffffff',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        style={{ background: BRAND }}
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-sm font-medium text-white">New Message</span>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()} role="presentation">
          <button type="button" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/15 transition-colors" onClick={() => setMinimized((m) => !m)} title={minimized ? 'Expand' : 'Minimize'}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/15 transition-colors" onClick={() => { setMaximized((m) => !m); setMinimized(false); }} title={maximized ? 'Restore' : 'Maximize'}>
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button type="button" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/15 transition-colors" onClick={() => { clearDraft(); onClose(); }} title="Discard">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!minimized && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.14, ease: 'easeInOut' }} style={{ overflow: 'hidden' }} className={maximized ? 'flex flex-col' : ''}>
            {/* To field */}
            <div className="px-4 py-2 border-b relative" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start gap-2 flex-wrap min-h-[28px]">
                <span className="text-xs font-medium mt-1.5 flex-shrink-0 w-5" style={{ color: 'var(--muted-foreground)' }}>To</span>
                <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
                  {recipients.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: BRAND_T, color: BRAND }}>
                      {r.name.split(' ')[0]}
                      <button type="button" onClick={() => setRecipients((p) => p.filter((x) => x.id !== r.id))} className="opacity-70 hover:opacity-100">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={recipientQuery}
                    onChange={(e) => handleRecipientInput(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder={recipients.length === 0 ? 'Search by name...' : ''}
                    className="flex-1 bg-transparent text-sm outline-none min-w-[120px] py-0.5"
                    style={{ color: 'var(--foreground)' }}
                  />
                </div>
              </div>
              {showDropdown && (recipientQuery.trim() || searchResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-0.5 rounded-lg border shadow-lg z-20 max-h-40 overflow-y-auto" style={{ background: '#fff', borderColor: 'var(--border)' }}>
                  {searching ? (
                    <p className="text-xs px-3 py-2.5" style={{ color: 'var(--muted-foreground)' }}>Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs px-3 py-2.5" style={{ color: 'var(--muted-foreground)' }}>No users found.</p>
                  ) : (
                    searchResults.filter((r) => !recipients.find((p) => p.id === r.id)).map((user) => (
                      <button key={user.id} type="button" onMouseDown={() => addRecipient(user)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] flex items-center justify-between gap-4 transition-colors" style={{ color: 'var(--foreground)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={user.name} size={24} />
                          <span className="truncate">{user.name}</span>
                        </div>
                        <span className="text-xs capitalize flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{user.role}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full bg-transparent text-sm outline-none" style={{ color: 'var(--foreground)' }} />
            </div>

            {/* Body */}
            <div className={maximized ? 'px-4 pt-3 pb-1 flex-1 flex flex-col' : 'px-4 pt-3 pb-1'}>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSend(); } }}
                placeholder="Write your message... (⌘Enter to send)"
                rows={maximized ? undefined : 8}
                className={`w-full bg-transparent text-sm outline-none resize-none leading-relaxed${maximized ? ' flex-1' : ''}`}
                style={{ color: 'var(--foreground)' }}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <select value={category} onChange={(e) => setCategory(e.target.value as MessageCategory)} className="text-xs bg-transparent outline-none rounded border px-2 py-1" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                <option value="general">General</option>
                <option value="medical">Medical (PHI)</option>
                <option value="application">Application</option>
                <option value="other">Other</option>
              </select>
              <button type="button" onClick={() => void handleSend()} disabled={!body.trim() || saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50" style={{ background: BRAND, color: '#ffffff' }}>
                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {saving ? 'Sending...' : 'Send'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ThreadRow ────────────────────────────────────────────────────────────────

function ThreadRow({
  conversation, selected, currentUserId, starred, onToggleStar, onClick,
}: {
  conversation:  Conversation;
  selected:      boolean;
  currentUserId?: number;
  starred:       boolean;
  onToggleStar:  (e: MouseEvent, id: number) => void;
  onClick:       () => void;
}) {
  const others      = conversation.participants.filter((p) => p.id !== currentUserId);
  const firstOther  = others[0];
  const displayName = others.length > 0 ? others.map((p) => p.name).join(', ') : 'Conversation';
  const isUnread    = conversation.unread_count > 0;
  const snippet     = conversation.last_message?.body ?? '';
  const isMedical   = conversation.category === 'medical';

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-all group hover:bg-[var(--dash-nav-hover-bg)]"
      style={{
        borderLeft: selected ? `3px solid ${BRAND}` : '3px solid transparent',
        background:  selected ? BRAND_T : isUnread ? 'rgba(22,163,74,0.025)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Star */}
      <button
        type="button"
        onClick={(e) => onToggleStar(e, conversation.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: starred ? '#f59e0b' : 'var(--muted-foreground)', opacity: starred ? 1 : undefined }}
        title={starred ? 'Unstar' : 'Star'}
      >
        <Star className="h-3.5 w-3.5" fill={starred ? '#f59e0b' : 'none'} />
      </button>

      {/* Avatar */}
      <Avatar name={firstOther?.name ?? '?'} size={34} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-sm truncate" style={{ color: 'var(--foreground)', fontWeight: isUnread ? 700 : 400 }}>
            {displayName}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isMedical && <Lock className="h-3 w-3" style={{ color: '#dc2626' }} />}
            <span className="text-xs" style={{ color: isUnread ? 'var(--foreground)' : 'var(--muted-foreground)', fontWeight: isUnread ? 600 : 400 }}>
              {threadTime(conversation.updated_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs truncate flex-1" style={{ color: 'var(--muted-foreground)' }}>
            {conversation.subject ? (
              <>
                <span style={{ fontWeight: isUnread ? 600 : 500, color: isUnread ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                  {conversation.subject}
                </span>
                {snippet && <span style={{ fontWeight: 400 }}> — {snippet}</span>}
              </>
            ) : snippet ? (
              <span style={{ fontWeight: isUnread ? 500 : 400 }}>{snippet}</span>
            ) : (
              <span style={{ fontStyle: 'italic' }}>No messages</span>
            )}
          </p>
          {isUnread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND }} aria-label={`${conversation.unread_count} unread`} />}
        </div>
      </div>
    </button>
  );
}

// ─── MessageThread ────────────────────────────────────────────────────────────

function MessageThread({ conversation, currentUserId, onBack, onArchived, onUnarchived }: {
  conversation:  Conversation;
  currentUserId?: number;
  onBack:        () => void;
  onArchived:    (id: number) => void;
  onUnarchived:  (c: Conversation) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);
  const cancelledRef            = useRef(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const isArchived              = !!conversation.archived_at;

  const loadMessages = useCallback(() => {
    cancelledRef.current = false;
    setLoading(true);
    setError(false);
    getMessages(conversation.id)
      .then((res) => { if (!cancelledRef.current) setMessages(res.data); })
      .catch(() => { if (!cancelledRef.current) setError(true); })
      .finally(() => { if (!cancelledRef.current) setLoading(false); });
  }, [conversation.id]);

  useEffect(() => { loadMessages(); return () => { cancelledRef.current = true; }; }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(conversation.id, body.trim());
      setMessages((prev) => [...prev, msg]);
      setBody('');
    } catch {
      toast.error('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleArchive() {
    try {
      await archiveConversation(conversation.id);
      onArchived(conversation.id);
      toast.success('Conversation archived.');
    } catch {
      toast.error('Failed to archive conversation.');
    }
  }

  async function handleUnarchive() {
    try {
      await unarchiveConversation(conversation.id);
      onUnarchived(conversation);
      toast.success('Conversation moved to inbox.');
    } catch {
      toast.error('Failed to unarchive conversation.');
    }
  }

  const others      = conversation.participants.filter((p) => p.id !== currentUserId);
  const displayName = others.length > 0 ? others.map((p) => p.name).join(', ') : conversation.subject ?? 'Conversation';
  const grouped     = groupByDay(messages);
  const isMedical   = conversation.category === 'medical';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ background: '#ffffff', borderColor: 'var(--border)' }}>
        <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors" style={{ color: 'var(--muted-foreground)' }}>
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center -space-x-2">
          {others.slice(0, 3).map((p) => (
            <div key={p.id} className="border-2 border-white rounded-full" title={p.name}>
              <Avatar name={p.name} size={32} />
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{displayName}</p>
            {isMedical && <PhiBadge />}
          </div>
          {conversation.subject && (
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{conversation.subject}</p>
          )}
        </div>

        {isArchived ? (
          <button onClick={handleUnarchive} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0" title="Move to inbox" style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
            <ArchiveX className="h-3.5 w-3.5" />
            Unarchive
          </button>
        ) : (
          <button onClick={handleArchive} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0" title="Archive" style={{ color: 'var(--muted-foreground)' }}>
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6" style={{ background: '#fafafa' }}>
        {loading ? (
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex items-end gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />
                <Skeletons.Block height={52} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Failed to load messages.</p>
            <button onClick={loadMessages} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No messages yet — say hello!</p>
          </div>
        ) : (
          grouped.map(({ label, msgs }) => (
            <div key={label}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-xs px-3 py-0.5 rounded-full" style={{ background: '#e5e7eb', color: 'var(--muted-foreground)' }}>
                  {label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>

              <div className="space-y-4">
                {msgs.map((msg) => {
                  const isMine  = msg.sender_id === currentUserId;
                  const sender  = msg.sender;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMine && (
                        <div className="flex-shrink-0">
                          {sender ? <Avatar name={sender.name} size={28} /> : <div className="w-7 h-7 rounded-full" style={{ background: 'var(--border)' }} />}
                        </div>
                      )}
                      {isMine && <div className="w-7 flex-shrink-0" />}

                      <div className={`flex flex-col max-w-[62%] ${isMine ? 'items-end' : 'items-start'}`}>
                        {!isMine && sender && (
                          <p className="text-xs mb-1 px-1" style={{ color: 'var(--muted-foreground)' }}>{sender.name.split(' ')[0]}</p>
                        )}
                        <div
                          className="px-4 py-2.5 text-sm leading-relaxed break-words"
                          style={{
                            background: isMine ? BRAND : '#ffffff',
                            color:      isMine ? '#ffffff' : 'var(--foreground)',
                            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            boxShadow: isMine ? 'none' : '0 1px 2px rgba(0,0,0,0.08)',
                            border: isMine ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          {msg.body}
                        </div>
                        <p className={`text-xs mt-1 ${isMine ? 'mr-1' : 'ml-1'}`} style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply composer */}
      {!isArchived && (
        <div className="flex items-end gap-3 px-5 py-4 border-t flex-shrink-0" style={{ background: '#ffffff', borderColor: 'var(--border)' }}>
          <div className="flex-1 rounded-2xl border px-4 py-2.5" style={{ background: 'var(--input)', borderColor: 'var(--border)' }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
              placeholder="Reply... (Shift+Enter for newline)"
              rows={1}
              className="w-full bg-transparent text-sm outline-none resize-none"
              style={{ color: 'var(--foreground)', minHeight: '20px', maxHeight: '96px' }}
            />
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={!body.trim() || sending}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: BRAND }}
            aria-label="Send reply"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send className="h-4 w-4 text-white" />
            }
          </button>
        </div>
      )}

      {isArchived && (
        <div className="flex items-center justify-center px-5 py-3 border-t" style={{ background: '#f9fafb', borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            This conversation is archived.{' '}
            <button onClick={handleUnarchive} className="underline font-medium" style={{ color: BRAND }}>
              Move to inbox
            </button>{' '}
            to reply.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── InboxPage ────────────────────────────────────────────────────────────────

export function InboxPage() {
  const currentUser = useAppSelector((state) => state.auth.user);

  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(false);
  const [selected, setSelected]             = useState<Conversation | null>(null);
  const [showCompose, setShowCompose]       = useState(false);
  const [mobileView, setMobileView]         = useState<'list' | 'thread'>('list');
  const [search, setSearch]                 = useState('');
  const [folder, setFolder]                 = useState<FolderView>('inbox');
  const [labelsOpen, setLabelsOpen]         = useState(true);
  const [starredIds, setStarredIds]         = useState<Set<number>>(loadStarred);

  // ── Fetch conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback((includeArchived = false) => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = includeArchived ? { include_archived: true as const } : undefined;
    getConversations(params)
      .then((res) => { if (!cancelled) setConversations(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = fetchConversations(folder === 'archive');
    return cleanup;
  }, [fetchConversations, folder]);

  // ── Starred sync ──────────────────────────────────────────────────────────

  useEffect(() => { saveStarred(starredIds); }, [starredIds]);

  function toggleStar(e: MouseEvent, id: number) {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = conversations.filter((c) => {
    // Folder filter
    switch (folder) {
      case 'inbox':       if (c.archived_at)                          return false; break;
      case 'starred':     if (!starredIds.has(c.id))                  return false; break;
      case 'sent':        if (c.last_message?.sender_id !== currentUser?.id) return false; break;
      case 'archive':     if (!c.archived_at)                         return false; break;
      default:            if (c.category !== folder)                  return false; break;
    }
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.subject?.toLowerCase().includes(q) ||
        c.participants.some((p) => p.name.toLowerCase().includes(q)) ||
        (c.last_message?.body.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // ── Counts for nav badges ─────────────────────────────────────────────────

  const activeConvs = conversations.filter((c) => !c.archived_at);
  const inboxUnread = activeConvs.reduce((n, c) => n + c.unread_count, 0);
  const starredCount = starredIds.size;
  const categoryCounts: Record<string, number> = {
    general:     activeConvs.filter((c) => c.category === 'general').length,
    medical:     activeConvs.filter((c) => c.category === 'medical').length,
    application: activeConvs.filter((c) => c.category === 'application').length,
    other:       activeConvs.filter((c) => c.category === 'other').length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectConversation(conv: Conversation) {
    setSelected(conv);
    setMobileView('thread');
    if (conv.unread_count > 0) {
      setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    }
  }

  function handleArchived(id: number) {
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, archived_at: new Date().toISOString() } : c));
    if (folder !== 'archive') {
      if (selected?.id === id) { setSelected(null); setMobileView('list'); }
    }
  }

  function handleUnarchived(conv: Conversation) {
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, archived_at: undefined } : c));
  }

  function handleFolderChange(f: FolderView) {
    setFolder(f);
    setSelected(null);
    setMobileView('list');
    setSearch('');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: Sidebar + thread list ─────────────────────────────────── */}
      <div
        className={`flex flex-col border-r flex-shrink-0 w-full lg:w-[340px] lg:min-w-[340px] lg:max-w-[340px] ${mobileView === 'thread' ? 'hidden lg:flex' : 'flex'}`}
        style={{ borderColor: 'var(--border)', background: '#ffffff' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND_T }}>
              <MessageSquare className="h-4 w-4" style={{ color: BRAND }} />
            </div>
            <h2 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Messages</h2>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: BRAND, color: '#ffffff' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Compose
          </button>
        </div>

        {/* Folder navigation */}
        <div className="flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
          <FolderNav
            folder={folder}
            onSelect={handleFolderChange}
            inboxCount={inboxUnread}
            starredCount={starredCount}
            categoryCounts={categoryCounts}
            labelsOpen={labelsOpen}
            onToggleLabels={() => setLabelsOpen((o) => !o)}
          />
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ background: 'var(--input)', borderColor: 'var(--border)' }}>
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ color: 'var(--muted-foreground)' }}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: '#e5e7eb' }} />
                  <div className="flex-1 space-y-1.5"><Skeletons.Row /></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>Failed to load conversations.</p>
              <button onClick={() => fetchConversations(folder === 'archive')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: BRAND_T }}>
                <MessageSquare className="h-6 w-6" style={{ color: BRAND }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {search ? 'No results' : folder === 'archive' ? 'Archive is empty' : folder === 'starred' ? 'No starred messages' : folder === 'sent' ? 'No sent messages' : 'No conversations'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  {search ? 'Try a different search term.' : folder === 'inbox' ? 'Click Compose to start a conversation.' : 'Nothing here yet.'}
                </p>
              </div>
              {folder === 'inbox' && !search && (
                <button onClick={() => setShowCompose(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all" style={{ background: BRAND, color: '#ffffff' }}>
                  <Plus className="h-4 w-4" />
                  Compose
                </button>
              )}
            </div>
          ) : (
            filtered.map((conv) => (
              <ThreadRow
                key={conv.id}
                conversation={conv}
                selected={selected?.id === conv.id}
                currentUserId={currentUser?.id}
                starred={starredIds.has(conv.id)}
                onToggleStar={toggleStar}
                onClick={() => handleSelectConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Message thread or empty state ─────────────────────────── */}
      <div className={`flex-1 min-w-0 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col`} style={{ background: '#fafafa' }}>
        {selected ? (
          <MessageThread
            key={selected.id}
            conversation={selected}
            currentUserId={currentUser?.id}
            onBack={() => setMobileView('list')}
            onArchived={handleArchived}
            onUnarchived={handleUnarchived}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: BRAND_T }}>
              <MessageSquare className="h-8 w-8" style={{ color: BRAND }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Select a conversation</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Choose from the list or compose a new message.</p>
            </div>
            <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all mt-1" style={{ background: BRAND, color: '#ffffff' }}>
              <Plus className="h-4 w-4" />
              Compose
            </button>
          </div>
        )}
      </div>

      {/* ── Floating compose ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCompose && (
          <FloatingCompose
            onClose={() => setShowCompose(false)}
            onCreated={(conv) => {
              setConversations((prev) => [conv, ...prev]);
              setSelected(conv);
              setFolder('inbox');
              setMobileView('thread');
              setShowCompose(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
