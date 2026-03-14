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
import { ArrowLeft, Archive, Paperclip, Send, X, Download, Bot, Eye, FileText } from 'lucide-react';
import {
  getMessages, sendMessage, archiveConversation, unarchiveConversation,
  downloadAttachment, getAttachmentBlobUrl,
  type Conversation, type Message, type MessageAttachment,
} from '@/features/messaging/api/messaging.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { RichTextEditor } from './editor/RichTextEditor';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#16a34a';

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

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

function getFileTypeStyle(mimeType: string): { color: string; isImage: boolean; isPdf: boolean } {
  if (mimeType?.startsWith('image/'))  return { color: '#2563eb', isImage: true,  isPdf: false };
  if (mimeType === 'application/pdf')  return { color: '#dc2626', isImage: false, isPdf: true  };
  if (mimeType?.includes('word') || mimeType?.includes('document'))
                                       return { color: '#7c3aed', isImage: false, isPdf: false };
  return                                      { color: '#6b7280', isImage: false, isPdf: false };
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
  const [previewUrls, setPreviewUrls]           = useState<Record<number, string>>({});
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Set<number>>(new Set());
  const [previewModal, setPreviewModal]           = useState<{ url: string; mimeType: string; name: string } | null>(null);
  const fileInputRef          = useRef<HTMLInputElement>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const cancelled             = useRef(false);
  const loadingPreviewsRef    = useRef<Set<number>>(new Set());
  const blobUrlsRef           = useRef<string[]>([]);

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

  // Revoke all blob URLs when the conversation changes or component unmounts
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      loadingPreviewsRef.current.clear();
      setPreviewUrls({});
      setPreviewModal(null);
      setPreviewLoadingIds(new Set());
    };
  }, [conversation.id]);

  // Eager-load image attachment previews via authenticated fetch.
  // PDFs are loaded on-demand via handlePreview to avoid fetching large files unnecessarily.
  useEffect(() => {
    for (const msg of messages) {
      for (const att of msg.attachments ?? []) {
        if (!att.mime_type?.startsWith('image/')) continue;
        if (loadingPreviewsRef.current.has(att.id)) continue;
        loadingPreviewsRef.current.add(att.id);
        const msgId = msg.id;
        const attId = att.id;
        getAttachmentBlobUrl(msgId, attId)
          .then((url) => {
            blobUrlsRef.current.push(url);
            if (!cancelled.current) {
              setPreviewUrls((prev) => ({ ...prev, [attId]: url }));
            } else {
              URL.revokeObjectURL(url);
            }
          })
          .catch(() => {
            loadingPreviewsRef.current.delete(attId);
          });
      }
    }
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

  async function handleDownload(messageId: number, att: MessageAttachment) {
    const name = att.original_filename || 'attachment';
    try {
      await downloadAttachment(messageId, att.id, name);
    } catch {
      toast.error(`Failed to download ${name}.`);
    }
  }

  async function handlePreview(messageId: number, att: MessageAttachment) {
    // Use cached blob URL if already loaded (images are eager-loaded)
    let url = previewUrls[att.id];
    if (!url) {
      setPreviewLoadingIds((prev) => new Set([...prev, att.id]));
      try {
        url = await getAttachmentBlobUrl(messageId, att.id);
        blobUrlsRef.current.push(url);
        setPreviewUrls((prev) => ({ ...prev, [att.id]: url }));
      } catch {
        toast.error(`Could not preview ${att.original_filename || 'file'}.`);
        return;
      } finally {
        setPreviewLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(att.id);
          return next;
        });
      }
    }
    setPreviewModal({ url, mimeType: att.mime_type, name: att.original_filename || 'Attachment' });
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
                        <div className={`flex flex-col gap-1.5 mt-1.5 ${isMine ? 'items-end' : 'items-start'}`}>
                          {msg.attachments.map((att) => {
                            const { color, isImage, isPdf } = getFileTypeStyle(att.mime_type ?? '');
                            const isPreviewable  = isImage || isPdf;
                            const preview        = previewUrls[att.id];
                            const previewLoading = previewLoadingIds.has(att.id);
                            const borderAlpha    = isMine ? 'rgba(255,255,255,0.20)' : 'var(--border)';
                            return (
                              <div
                                key={att.id}
                                className="rounded-xl overflow-hidden flex-shrink-0"
                                style={{
                                  width: 256,
                                  border: `1px solid ${borderAlpha}`,
                                  background: isMine ? BRAND : 'var(--card)',
                                }}
                              >
                                {/* Image thumbnail (eager-loaded) */}
                                {isImage && preview && (
                                  <button
                                    type="button"
                                    className="w-full block p-0 border-0 bg-transparent cursor-zoom-in"
                                    onClick={() => setPreviewModal({ url: preview, mimeType: att.mime_type, name: att.original_filename || 'Attachment' })}
                                    aria-label={`Preview ${att.original_filename || 'image'}`}
                                  >
                                    <img
                                      src={preview}
                                      alt={att.original_filename || 'Image attachment'}
                                      className="w-full block object-cover"
                                      style={{ maxHeight: 160 }}
                                    />
                                  </button>
                                )}
                                {/* Placeholder while image blob loads */}
                                {isImage && !preview && (
                                  <div
                                    className="w-full flex items-center justify-center"
                                    style={{ height: 72, background: 'rgba(0,0,0,0.04)' }}
                                  >
                                    <Paperclip className="h-5 w-5 opacity-20" />
                                  </div>
                                )}

                                {/* File info row */}
                                <div className="flex items-center gap-2.5 px-3 py-2.5">
                                  {/* File-type badge */}
                                  <div
                                    className="flex-shrink-0 flex items-center justify-center rounded-lg"
                                    style={{
                                      width: 34, height: 34,
                                      background: isMine ? 'rgba(255,255,255,0.20)' : color + '1a',
                                      color: isMine ? '#fff' : color,
                                    }}
                                  >
                                    {isImage
                                      ? <Paperclip className="h-4 w-4" />
                                      : <FileText  className="h-4 w-4" />
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-xs font-semibold truncate"
                                      style={{ color: isMine ? '#fff' : 'var(--foreground)' }}
                                    >
                                      {att.original_filename || 'Attachment'}
                                    </p>
                                    <p
                                      className="text-xs"
                                      style={{ color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground)' }}
                                    >
                                      {formatFileSize(att.file_size)}
                                    </p>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div
                                  className="flex border-t"
                                  style={{ borderColor: borderAlpha }}
                                >
                                  {isPreviewable && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void handlePreview(msg.id, att)}
                                        disabled={previewLoading}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
                                        style={{ color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--muted-foreground)' }}
                                        aria-label={`Preview ${att.original_filename || 'file'}`}
                                      >
                                        <Eye className="h-3 w-3" />
                                        {previewLoading ? '…' : 'Preview'}
                                      </button>
                                      <div className="w-px" style={{ background: borderAlpha }} />
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleDownload(msg.id, att)}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                    style={{ color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--muted-foreground)' }}
                                    aria-label={`Download ${att.original_filename || 'file'}`}
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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

      {/* ── Attachment preview modal ───────────────────────────────────────── */}
      {previewModal && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Preview ${previewModal.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setPreviewModal(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') setPreviewModal(null); }}
        >
          <div
            role="presentation"
            className="relative rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxWidth: '90vw', maxHeight: '90vh', background: 'var(--card)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Preview content */}
            {previewModal.mimeType.startsWith('image/') ? (
              <img
                src={previewModal.url}
                alt={previewModal.name}
                style={{ maxWidth: '85vw', maxHeight: '78vh', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <iframe
                src={previewModal.url}
                title={previewModal.name}
                style={{ width: 'min(860px, 85vw)', height: '78vh', border: 'none', display: 'block' }}
              />
            )}
            {/* Footer bar */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-t flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>
                {previewModal.name}
              </p>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

