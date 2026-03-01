/**
 * ThreadView.tsx
 *
 * Conversation thread view — extracted from InboxPage for clean separation.
 * Shows the message list, thread header, and reply compose box.
 *
 * Note: does NOT have its own entry animation — parent InboxPage wraps it
 * in AnimatePresence mode="wait" for the crossfade transition between views.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Archive, Lock, Paperclip, Send, X, Download, Bot } from 'lucide-react';
import {
  getMessages, sendMessage, archiveConversation, unarchiveConversation, downloadAttachment,
  type Conversation, type Message,
} from '@/features/messaging/api/messaging.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { RichTextEditor } from './editor/RichTextEditor';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#16a34a';

// ─── Badge helpers ────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  application:   { bg: 'rgba(22,163,74,0.12)',  color: BRAND,      label: 'Applicants'   },
  medical:       { bg: 'rgba(37,99,235,0.12)',  color: '#2563eb',  label: 'Medical Team' },
  general:       { bg: 'rgba(107,114,128,0.12)',color: '#6b7280',  label: 'System'       },
  other:         { bg: 'rgba(107,114,128,0.12)',color: '#6b7280',  label: 'System'       },
  announcements: { bg: 'rgba(245,158,11,0.12)', color: '#d97706',  label: 'Announcements'},
};

const SYSTEM_CATEGORY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  application: { bg: 'rgba(22,163,74,0.12)',  color: BRAND,     label: 'Application' },
  security:    { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'Security'    },
  role:        { bg: 'rgba(124,58,237,0.12)',  color: '#7c3aed', label: 'Role Change' },
  medical:     { bg: 'rgba(37,99,235,0.12)',   color: '#2563eb', label: 'Medical'     },
};

function CategoryBadge({ category, isSystem, systemCategory }: {
  category?: string;
  isSystem?: boolean;
  systemCategory?: string;
}) {
  if (isSystem) {
    const s = SYSTEM_CATEGORY_STYLES[systemCategory ?? ''] ?? { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'System' };
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ background: s.bg, color: s.color }}
      >
        <Bot className="h-3 w-3 flex-shrink-0" />
        {s.label}
      </span>
    );
  }
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ThreadViewProps {
  conversation: Conversation;
  currentUserId?: number;
  onBack: () => void;
  onArchive: (id: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThreadView({ conversation, currentUserId, onBack, onArchive }: ThreadViewProps) {
  const isSystem = conversation.is_system_generated === true;

  const [messages, setMessages]       = useState<Message[]>([]);
  const [loading, setLoading]         = useState(true);
  const [replyHtml, setReplyHtml]     = useState('');
  const [sending, setSending]         = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [archiving, setArchiving]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const cancelled    = useRef(false);

  // Load messages when conversation changes
  useEffect(() => {
    cancelled.current = false;
    setLoading(true);
    getMessages(conversation.id)
      .then((res) => { if (!cancelled.current) setMessages(res.data); })
      .catch(() => { if (!cancelled.current) toast.error('Could not load messages.'); })
      .finally(() => { if (!cancelled.current) setLoading(false); });
    return () => { cancelled.current = true; };
  }, [conversation.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const plainText = replyHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText && attachments.length === 0) return;
    setSending(true);
    try {
      const msg = await sendMessage(
        conversation.id,
        replyHtml,
        attachments.length > 0 ? attachments : undefined,
      );
      setMessages((p) => [...p, msg]);
      setReplyHtml('');
      setAttachments([]);
    } catch {
      toast.error('Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      if (conversation.archived_at) {
        await unarchiveConversation(conversation.id);
        toast.success('Conversation restored to inbox.');
      } else {
        await archiveConversation(conversation.id);
        toast.success('Conversation archived.');
      }
      onArchive(conversation.id);
    } catch {
      toast.error('Action failed.');
    } finally {
      setArchiving(false);
    }
  }

  const others      = conversation.participants.filter((p) => p.id !== currentUserId);
  const displayName = isSystem ? 'Camp Burnt Gin' : (others.length > 0 ? others[0].name : 'Conversation');

  return (
    <div className="flex flex-col h-full">

      {/* ── Thread header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          aria-label="Back to inbox"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
        </button>

        {isSystem ? (
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 32, height: 32, background: 'rgba(22,163,74,0.12)' }}
          >
            <Bot className="h-4 w-4" style={{ color: BRAND }} />
          </div>
        ) : (
          <Avatar name={displayName} size={32} />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
            {conversation.subject ?? displayName}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {isSystem ? 'Automated system notification' : conversation.participants.map((p) => p.name).join(', ')}
          </p>
        </div>

        <CategoryBadge
          category={conversation.category}
          isSystem={isSystem}
          systemCategory={conversation.system_event_category}
        />

        {!isSystem && conversation.category === 'medical' && (
          <span
            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
          >
            <Lock className="h-2.5 w-2.5" />
            PHI
          </span>
        )}

        {!isSystem && (
          <button
            onClick={() => void handleArchive()}
            disabled={archiving}
            title={conversation.archived_at ? 'Restore to inbox' : 'Archive'}
            aria-label={conversation.archived_at ? 'Restore to inbox' : 'Archive conversation'}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
          >
            <Archive className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeletons.Row key={i} />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm py-12" style={{ color: 'var(--muted-foreground)' }}>
            No messages yet.
          </p>
        ) : (
          messages.map((msg) => {
            const isSystemMsg = msg.sender_id === null;
            const isMine      = !isSystemMsg && msg.sender_id === currentUserId;
            const senderName  = isSystemMsg ? 'Camp Burnt Gin' : (msg.sender?.name ?? 'Unknown');
            return (
              <div
                key={msg.id}
                className={isSystemMsg ? 'flex justify-center' : `flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
              >
                {/* System message: centered notification style */}
                {isSystemMsg ? (
                  <div
                    className="w-full max-w-lg px-4 py-3 rounded-xl text-sm leading-relaxed"
                    style={{
                      background: 'rgba(22,163,74,0.06)',
                      border: '1px solid rgba(22,163,74,0.18)',
                      color: 'var(--foreground)',
                    }}
                    // msg.body comes from our own server — sanitized at API layer
                    dangerouslySetInnerHTML={{ __html: msg.body }}
                  />
                ) : (
                  <>
                    {!isMine && <Avatar name={senderName} size={30} />}
                    <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : ''}`}>
                      {!isMine && (
                        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          {senderName.split(' ')[0]}
                        </p>
                      )}
                      <div
                        className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={{
                          background: isMine ? BRAND : 'var(--glass-medium)',
                          color: isMine ? '#fff' : 'var(--foreground)',
                          borderBottomRightRadius: isMine ? 4 : undefined,
                          borderBottomLeftRadius:  isMine ? undefined : 4,
                        }}
                        // msg.body comes from our own server — sanitized at API layer
                        dangerouslySetInnerHTML={{ __html: msg.body }}
                      />
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          {msg.attachments.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => void downloadAttachment(msg.id, att.id, att.name)}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                              title={`Download ${att.name}`}
                            >
                              <Paperclip className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{att.name}</span>
                              <Download className="h-3 w-3 flex-shrink-0 ml-auto" />
                            </button>
                          ))}
                        </div>
                      )}
                      <time className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {format(new Date(msg.created_at), 'h:mm a · MMM d')}
                      </time>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply box / system notice / archived notice ───────────────────── */}
      {isSystem ? (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'rgba(22,163,74,0.04)' }}
        >
          <Bot className="h-3.5 w-3.5 flex-shrink-0" style={{ color: BRAND }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            This is an automated system notification. Replies are not supported.
          </p>
        </div>
      ) : conversation.archived_at ? (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            This conversation is archived.
          </p>
          <button
            onClick={() => void handleArchive()}
            className="text-sm font-medium hover:underline"
            style={{ color: BRAND }}
          >
            Restore to inbox
          </button>
        </div>
      ) : (
        <div
          className="border-t flex-shrink-0 overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <RichTextEditor
            onUpdate={setReplyHtml}
            placeholder="Write a reply…"
            minHeight={80}
          />

          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              {attachments.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <Paperclip className="h-3 w-3" />
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Send row */}
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files ?? [])])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                aria-label="Attach file"
                className="p-1.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                <Paperclip className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ background: BRAND }}
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

