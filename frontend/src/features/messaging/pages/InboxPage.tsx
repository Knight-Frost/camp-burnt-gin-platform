/**
 * InboxPage.tsx
 *
 * Two-panel inbox: conversation list (left) + message thread (right).
 * Responsive: single panel on mobile with back navigation.
 * Route: /inbox
 */

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  MessageSquare, Send, Plus, ArrowLeft,
  Archive, X, Search, UserPlus, ChevronDown,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

import {
  getConversations, getMessages, sendMessage,
  createConversation, archiveConversation, searchInboxUsers,
  type Conversation, type Message, type ConversationParticipant, type MessageCategory,
} from '@/features/messaging/api/messaging.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { pageEntry, modalBackdrop, modalContent } from '@/shared/constants/motion';
import { useAppSelector } from '@/store/hooks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date))     return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function groupMessagesByDay(messages: Message[]): Array<{ label: string; messages: Message[] }> {
  const groups: Record<string, Message[]> = {};
  for (const msg of messages) {
    const date = new Date(msg.created_at);
    const key = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMMM d, yyyy');
    if (!groups[key]) groups[key] = [];
    groups[key].push(msg);
  }
  return Object.entries(groups).map(([label, messages]) => ({ label, messages }));
}

// ---------------------------------------------------------------------------
// New conversation modal (with recipient search + category)
// ---------------------------------------------------------------------------

const CATEGORIES: { value: MessageCategory; label: string }[] = [
  { value: 'general',     label: 'General' },
  { value: 'medical',     label: 'Medical' },
  { value: 'application', label: 'Application' },
  { value: 'other',       label: 'Other' },
];

interface NewConversationModalProps {
  onClose: () => void;
  onCreated: (c: Conversation) => void;
}

function NewConversationModal({ onClose, onCreated }: NewConversationModalProps) {
  const { t } = useTranslation();
  const [subject, setSubject]               = useState('');
  const [message, setMessage]               = useState('');
  const [category, setCategory]             = useState<MessageCategory>('general');
  const [saving, setSaving]                 = useState(false);

  // Recipient search
  const [recipientQuery, setRecipientQuery] = useState('');
  const [searchResults, setSearchResults]   = useState<ConversationParticipant[]>([]);
  const [searching, setSearching]           = useState(false);
  const [recipients, setRecipients]         = useState<ConversationParticipant[]>([]);
  const [showDropdown, setShowDropdown]     = useState(false);
  const searchTimeout                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleRecipientInput(val: string) {
    setRecipientQuery(val);
    setShowDropdown(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(() => {
      setSearching(true);
      searchInboxUsers(val)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 350);
  }

  function addRecipient(user: ConversationParticipant) {
    if (!recipients.find((r) => r.id === user.id)) {
      setRecipients((prev) => [...prev, user]);
    }
    setRecipientQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  function removeRecipient(id: number) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSaving(true);
    try {
      const conv = await createConversation({
        subject,
        participant_ids: recipients.map((r) => r.id),
        message,
        category,
      });
      onCreated(conv);
      toast.success(t('inbox.conversation_created'));
    } catch {
      toast.error(t('common.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      variants={modalBackdrop} initial="hidden" animate="visible" exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        variants={modalContent}
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('inbox.new_conversation')}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted-foreground)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Recipients
            </label>
            {/* Selected recipients chips */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {recipients.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{ background: 'rgba(22,101,52,0.12)', color: 'var(--forest-green)' }}
                  >
                    {r.name}
                    <button type="button" onClick={() => removeRecipient(r.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Search input */}
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}>
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  value={recipientQuery}
                  onChange={(e) => handleRecipientInput(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by name..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--foreground)' }}
                />
                <UserPlus className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              {/* Dropdown */}
              {showDropdown && (recipientQuery.trim() || searchResults.length > 0) && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-10 max-h-40 overflow-y-auto"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  {searching ? (
                    <p className="text-xs px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>No users found.</p>
                  ) : (
                    searchResults
                      .filter((r) => !recipients.find((p) => p.id === r.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onMouseDown={() => addRecipient(user)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex items-center justify-between"
                          style={{ color: 'var(--foreground)' }}
                        >
                          <span>{user.name}</span>
                          <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{user.role}</span>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none appearance-none"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('inbox.subject')}
            </label>
            <input
              value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={t('inbox.subject_placeholder')}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('inbox.message')}
            </label>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)}
              rows={4} required
              placeholder={t('inbox.message_placeholder')}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={{ background: 'var(--cta-primary-bg)', color: 'var(--cta-primary-color)' }}>
              {saving ? t('common.sending') : t('inbox.send')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Conversation list item
// ---------------------------------------------------------------------------

interface ConvItemProps {
  conversation: Conversation;
  selected: boolean;
  currentUserId?: number;
  onClick: () => void;
}

function ConvItem({ conversation, selected, currentUserId, onClick }: ConvItemProps) {
  const others = conversation.participants.filter((p) => p.id !== currentUserId);
  const displayName = others.length > 0
    ? others.map((p) => p.name.split(' ')[0]).join(', ')
    : conversation.subject ?? 'Conversation';

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 border-b transition-all"
      style={{
        borderColor: 'var(--border)',
        background: selected ? 'rgba(34,197,94,0.08)' : 'transparent',
        borderLeft: selected ? '3px solid var(--ember-orange)' : '3px solid transparent',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {displayName}
            </p>
            {conversation.unread_count > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                style={{ background: 'var(--ember-orange)', color: '#fff', fontSize: '10px' }}
              >
                {conversation.unread_count}
              </span>
            )}
          </div>
          {conversation.subject && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
              {conversation.subject}
            </p>
          )}
          {conversation.last_message && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
              {conversation.last_message.body}
            </p>
          )}
        </div>
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          {formatMessageTime(conversation.updated_at)}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Message thread
// ---------------------------------------------------------------------------

interface ThreadProps {
  conversation: Conversation;
  currentUserId?: number;
  onBack: () => void;
}

function MessageThread({ conversation, currentUserId, onBack }: ThreadProps) {
  const { t } = useTranslation();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [body, setBody]           = useState('');
  const [sending, setSending]     = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getMessages(conversation.id)
      .then((res) => setMessages(res.data))
      .finally(() => setLoading(false));
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(conversation.id, body.trim());
      setMessages((prev) => [...prev, msg]);
      setBody('');
    } catch {
      toast.error(t('inbox.send_error'));
    } finally {
      setSending(false);
    }
  }

  const others = conversation.participants.filter((p) => p.id !== currentUserId);
  const displayName = others.length > 0
    ? others.map((p) => p.name).join(', ')
    : conversation.subject ?? 'Conversation';

  const grouped = groupMessagesByDay(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--glass-medium)' }}
      >
        <button onClick={onBack} className="lg:hidden p-1.5" style={{ color: 'var(--muted-foreground)' }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{displayName}</p>
          {conversation.subject && (
            <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{conversation.subject}</p>
          )}
        </div>
        <button
          onClick={() => archiveConversation(conversation.id).catch(() => null)}
          className="p-1.5 rounded transition-colors"
          title={t('inbox.archive')}
          style={{ color: 'var(--muted-foreground)' }}
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeletons.Block key={i} height={48} />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('inbox.no_messages')}</p>
          </div>
        ) : (
          grouped.map(({ label, messages: groupMsgs }) => (
            <div key={label}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <p className="text-xs px-2" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
              <div className="space-y-3">
                {groupMsgs.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%]">
                        {!isMine && msg.sender && (
                          <p className="text-xs mb-1 ml-1" style={{ color: 'var(--muted-foreground)' }}>
                            {msg.sender.name}
                          </p>
                        )}
                        <div
                          className="rounded-2xl px-4 py-2.5 text-sm"
                          style={{
                            background: isMine ? 'var(--cta-primary-bg)' : 'var(--glass-medium)',
                            color: isMine ? 'var(--cta-primary-color)' : 'var(--foreground)',
                            borderBottomRightRadius: isMine ? '4px' : '16px',
                            borderBottomLeftRadius: isMine ? '16px' : '4px',
                          }}
                        >
                          {msg.body}
                        </div>
                        <p className={`text-xs mt-1 ${isMine ? 'text-right' : 'text-left'} mx-1`}
                          style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(msg.created_at), 'HH:mm')}
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

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-3 px-5 py-4 border-t flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--glass-medium)' }}
      >
        <div
          className="flex-1 rounded-xl border px-4 py-2.5 flex items-end gap-2"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(e); } }}
            placeholder={t('inbox.type_message')}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none"
            style={{ color: 'var(--foreground)', minHeight: '20px', maxHeight: '100px' }}
          />
        </div>
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all disabled:opacity-40"
          style={{ background: 'var(--cta-primary-bg)' }}
        >
          <Send className="h-4 w-4" style={{ color: 'var(--cta-primary-color)' }} />
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main inbox page
// ---------------------------------------------------------------------------

export function InboxPage() {
  const { t } = useTranslation();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [selected, setSelected]                 = useState<Conversation | null>(null);
  const [showNewModal, setShowNewModal]          = useState(false);
  const [mobileView, setMobileView]             = useState<'list' | 'thread'>('list');
  const [search, setSearch]                     = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConversations();
      setConversations(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);

  function handleSelectConversation(conv: Conversation) {
    setSelected(conv);
    setMobileView('thread');
  }

  // Filter conversations by search query (subject or participant name)
  const filteredConversations = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.subject?.toLowerCase().includes(q) ||
          c.participants.some((p) => p.name.toLowerCase().includes(q)) ||
          c.last_message?.body.toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <motion.div
      variants={pageEntry}
      initial="hidden"
      animate="visible"
      className="h-full flex"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Conversation list */}
      <div
        className={`flex flex-col border-r ${mobileView === 'thread' ? 'hidden lg:flex' : 'flex'}`}
        style={{
          width: '320px',
          minWidth: '320px',
          borderColor: 'var(--border)',
          background: 'var(--glass-medium)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            {t('inbox.title')}
          </h2>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--ember-orange)' }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{ background: 'var(--input)', borderColor: 'var(--border)' }}>
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeletons.Row key={i} />)}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={search ? 'No matches' : t('inbox.empty_title')}
                description={search ? 'Try a different search.' : t('inbox.empty_desc')}
                action={!search ? { label: t('inbox.new_conversation'), onClick: () => setShowNewModal(true) } : undefined}
              />
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conversation={conv}
                selected={selected?.id === conv.id}
                currentUserId={currentUser?.id}
                onClick={() => handleSelectConversation(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* Thread panel */}
      <div
        className={`flex-1 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col`}
        style={{ background: 'var(--background)' }}
      >
        {selected ? (
          <MessageThread
            conversation={selected}
            currentUserId={currentUser?.id}
            onBack={() => setMobileView('list')}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl"
              style={{ background: 'rgba(34,197,94,0.1)' }}
            >
              <MessageSquare className="h-6 w-6" style={{ color: 'var(--ember-orange)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('inbox.select_conversation')}
            </p>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      <AnimatePresence>
        {showNewModal && (
          <NewConversationModal
            onClose={() => setShowNewModal(false)}
            onCreated={(conv) => {
              setConversations((prev) => [conv, ...prev]);
              setSelected(conv);
              setMobileView('thread');
              setShowNewModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
