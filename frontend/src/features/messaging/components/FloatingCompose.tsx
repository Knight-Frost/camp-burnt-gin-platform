/**
 * FloatingCompose.tsx
 *
 * Gmail-style floating compose panel.
 *
 * Layout (top → bottom):
 *   ┌─ Header ────────────────────────── [−] [⤢] [✕] ─┐
 *   ├─ To: recipients ─────────────────────────────────┤
 *   ├─ Subject: ────────────────────── [Category ▾] ───┤
 *   │  Editor body (flex-1, scrollable)                 │
 *   │                                                   │
 *   ├─ Attachment chips (if any) ──────────────────────┤
 *   └─ [↑] [B][I][U]|[•][1.]|[🔗][😊]    [Send →] ───┘
 *
 * Key behaviors:
 *   - Neutral light header (var(--card) bg) — NOT green, NOT dark
 *   - Toolbar lives in the footer bar (Gmail-style, bottom)
 *   - Upload icon (not paperclip) triggers file picker from footer left
 *   - Minimize: collapses to header bar only
 *   - Maximize: fixed inset-4 fullscreen with backdrop
 *   - Draft autosave: 1.5s debounce; header shows "Saving…" / "Draft saved"
 *   - Close guard: ConfirmDialog (NOT window.confirm) when unsaved content
 */

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { X, Minus, Maximize2, Minimize2, Upload, Send } from 'lucide-react';
import {
  createConversation, sendMessage, searchInboxUsers,
  type Conversation, type ConversationParticipant,
  type MessageCategory, type NewConversationPayload,
} from '@/features/messaging/api/messaging.api';
import { useRichEditor, EditorBody, EditorToolbar } from './editor/RichTextEditor';
import { ConfirmDialog } from '@/ui/overlay/ConfirmDialog';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = 'inbox_compose_draft';
interface Draft { subject: string; body: string }
function saveDraft(d: Draft)       { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /**/ } }
function loadDraft(): Draft | null { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null; } catch { return null; } }
function clearDraft()              { try { localStorage.removeItem(DRAFT_KEY); } catch { /**/ } }

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

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none"
      style={{ width: size, height: size, background: avatarBg(name), color: '#fff', fontSize: 10, lineHeight: 1 }}
    >
      {initials(name)}
    </div>
  );
}

// ─── SaveStatus ───────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FloatingComposeProps {
  onClose:   () => void;
  onCreated: (c: Conversation) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FloatingCompose({ onClose, onCreated }: FloatingComposeProps) {
  // ── Panel state
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // ── Form state
  const [sending, setSending]               = useState(false);
  const [recipients, setRecipients]         = useState<ConversationParticipant[]>([]);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [searchResults, setSearchResults]   = useState<ConversationParticipant[]>([]);
  const [searching, setSearching]           = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [subject, setSubject]               = useState(() => loadDraft()?.subject ?? '');
  const [bodyHtml, setBodyHtml]             = useState('');
  const [category, setCategory]             = useState<MessageCategory>('general');
  const [attachments, setAttachments]       = useState<File[]>([]);
  const [saveStatus, setSaveStatus]         = useState<SaveStatus>('idle');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // ── Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Editor — created once at component level so it persists across minimize/maximize
  const editor = useRichEditor({
    onUpdate: (html) => {
      setBodyHtml(html);
      // Trigger autosave
      setSaveStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDraft({ subject, body: html });
        setSaveStatus('saved');
      }, 1500);
    },
    placeholder: 'Write your message…',
  });

  // Subject autosave — keep in sync with bodyHtml autosave
  function handleSubjectChange(val: string) {
    setSubject(val);
    if (!val && !bodyHtml) return;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft({ subject: val, body: bodyHtml });
      setSaveStatus('saved');
    }, 1500);
  }

  // ── Recipient search
  function handleRecipientInput(val: string) {
    setRecipientQuery(val);
    setShowDropdown(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      searchInboxUsers(val)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }

  function addRecipient(u: ConversationParticipant) {
    if (!recipients.find((r) => r.id === u.id)) setRecipients((p) => [...p, u]);
    setRecipientQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  // ── Send
  async function handleSend() {
    const plainText = bodyHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText) { toast.error('Message body is empty.'); return; }
    if (recipients.length === 0) { toast.error('Please add at least one recipient.'); return; }
    setSending(true);
    try {
      const payload: NewConversationPayload = {
        participant_ids: recipients.map((r) => r.id),
        category,
      };
      if (subject.trim()) payload.subject = subject.trim();
      const conv = await createConversation(payload);
      await sendMessage(conv.id, bodyHtml, attachments.length > 0 ? attachments : undefined);
      clearDraft();
      onCreated(conv);
      toast.success('Message sent.');
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // ── Close guard
  const hasUnsavedContent = recipients.length > 0
    || subject.trim().length > 0
    || bodyHtml.replace(/<[^>]*>/g, '').trim().length > 0;

  function handleClose() {
    if (hasUnsavedContent && saveStatus !== 'saved') {
      setConfirmCloseOpen(true);
      return;
    }
    clearDraft();
    onClose();
  }

  function handleConfirmDiscard() {
    clearDraft();
    setConfirmCloseOpen(false);
    onClose();
  }

  const headerStatusText = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'saved'
    ? 'Draft saved'
    : null;

  // Panel dimensions
  const panelHeight = minimized ? undefined : (maximized ? undefined : 480);

  return (
    <>
      {/* Fullscreen backdrop */}
      {maximized && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Exit fullscreen"
          className="fixed inset-0 bg-black/30"
          style={{ zIndex: 999 }}
          onClick={() => setMaximized(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMaximized(false); }}
        />
      )}

      {/* ── Compose panel ─────────────────────────────────────────────────── */}
      <div
        className={
          maximized
            ? 'fixed inset-4 rounded-2xl border overflow-hidden shadow-2xl flex flex-col'
            : 'fixed bottom-0 right-8 rounded-t-2xl border overflow-hidden shadow-2xl flex flex-col'
        }
        style={{
          width: maximized ? undefined : 560,
          height: panelHeight,
          background: 'var(--card)',
          borderColor: 'var(--border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          zIndex: maximized ? 1000 : 500,
        }}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          aria-label={minimized ? 'Expand compose' : 'Minimize compose'}
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none flex-shrink-0 border-b"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          onClick={() => { if (!maximized) setMinimized((v) => !v); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !maximized) setMinimized((v) => !v); }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate max-w-[240px]">
              {minimized && subject ? subject : 'New Message'}
            </span>
            {headerStatusText && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {headerStatusText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }}
              title={minimized ? 'Expand' : 'Minimize'}
              aria-label={minimized ? 'Expand compose' : 'Minimize compose'}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              <Minus className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMaximized((v) => !v); setMinimized(false); }}
              title={maximized ? 'Restore' : 'Maximize'}
              aria-label={maximized ? 'Restore compose' : 'Maximize compose'}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              {maximized
                ? <Minimize2 className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                : <Maximize2 className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              }
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              title="Close"
              aria-label="Close compose"
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>

        {/* ── Body (hidden when minimized) ──────────────────────────────── */}
        {!minimized && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* Recipients */}
            <div
              className="relative border-b px-4 py-2 flex flex-wrap gap-1 items-center flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-medium w-12 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>To</span>
              {recipients.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: BRAND_T, color: BRAND }}
                >
                  {r.name}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setRecipients((p) => p.filter((x) => x.id !== r.id))}
                    aria-label={`Remove ${r.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={recipientQuery}
                onChange={(e) => handleRecipientInput(e.target.value)}
                onFocus={() => { if (recipientQuery.trim()) setShowDropdown(true); }}
                onBlur={() => { setTimeout(() => setShowDropdown(false), 150); }}
                placeholder={recipients.length === 0 ? 'Search people…' : ''}
                className="flex-1 min-w-20 text-sm bg-transparent outline-none py-0.5"
                style={{ color: 'var(--foreground)' }}
              />

              {/* Autocomplete dropdown */}
              {showDropdown && (searchResults.length > 0 || searching) && (
                <div
                  className="absolute left-0 top-full mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', zIndex: 100 }}
                >
                  {searching && (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Searching…
                    </div>
                  )}
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={() => addRecipient(u)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                    >
                      <Avatar name={u.name} size={24} />
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{u.name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subject + Category */}
            <div
              className="border-b px-4 py-2 flex items-center gap-3 flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-medium w-12 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>Subject</span>
              <input
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Subject (optional)"
                className="flex-1 text-sm bg-transparent outline-none py-0.5"
                style={{ color: 'var(--foreground)' }}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className="text-xs border rounded-md px-2 py-1 outline-none flex-shrink-0"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <option value="general">General</option>
                <option value="application">Application</option>
                <option value="medical">Medical</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* ── Editor body (flex-1, fills remaining space) ──────────── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <EditorBody
                editor={editor}
                minHeight={maximized ? 320 : 160}
                className="px-4 py-3 h-full"
              />
            </div>

            {/* ── Attachment chips (above footer, only when files attached) */}
            {attachments.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 px-4 py-2 border-t flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                {attachments.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--dash-nav-hover-bg)' }}
                  >
                    <Upload className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="ml-0.5 rounded-full hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Footer toolbar row (Gmail-style bottom bar) ──────────── */}
            <div
              className="flex items-center justify-between px-3 py-2 border-t flex-shrink-0"
              style={{ borderColor: 'var(--border)', minHeight: 52 }}
            >
              {/* Left cluster: Upload + separator + formatting toolbar */}
              <div className="flex items-center gap-1">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files ?? [])])}
                />
                {/* Upload button */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  aria-label="Attach file"
                  className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                >
                  <Upload className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                </button>

                {/* Vertical separator */}
                <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: 'var(--border)' }} />

                {/* Formatting toolbar */}
                <EditorToolbar editor={editor} />
              </div>

              {/* Right: Send button */}
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 flex-shrink-0"
                style={{ background: BRAND }}
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discard draft confirm */}
      <ConfirmDialog
        open={confirmCloseOpen}
        title="Discard draft?"
        message="Your draft will be permanently lost."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  );
}
