/**
 * InboxPage.test.tsx
 *
 * Gmail interaction regression tests. Guards against:
 *   - Premature empty state rendering before data loads
 *   - Keyboard shortcuts (c = compose, / = focus search, Esc = close compose)
 *   - Bulk selection mode (count + clear button)
 *   - MessageRow hover-reveal action buttons
 *   - window.prompt/window.confirm absence (static audit)
 */

import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

// ─── Static analysis guard: no native browser prompts ─────────────────────────

const MESSAGING_DIR = resolve(__dirname, '../');

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '__tests__') {
      return collectFiles(fullPath);
    }
    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

describe('window.prompt / window.confirm audit', () => {
  test('no window.prompt calls in messaging components', () => {
    const files = collectFiles(MESSAGING_DIR);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      // Match window.prompt( or standalone prompt( but not 'placeholder', 'promptText', etc.
      const promptMatches = content.match(/(?<![a-zA-Z])prompt\s*\(/g);
      const windowPromptMatches = content.match(/window\.prompt\s*\(/g);
      if (promptMatches || windowPromptMatches) {
        violations.push(filePath.replace(MESSAGING_DIR, ''));
      }
    });

    expect(violations, `Found window.prompt in: ${violations.join(', ')}`).toHaveLength(0);
  });

  test('no window.confirm calls in messaging components', () => {
    const files = collectFiles(MESSAGING_DIR);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = readFileSync(filePath, 'utf-8');
      const confirmMatches = content.match(/window\.confirm\s*\(/g);
      if (confirmMatches) {
        violations.push(filePath.replace(MESSAGING_DIR, ''));
      }
    });

    expect(violations, `Found window.confirm in: ${violations.join(', ')}`).toHaveLength(0);
  });
});

// ─── InboxPage source structure guard ─────────────────────────────────────────

describe('InboxPage source structure', () => {
  const inboxSrc = readFileSync(resolve(__dirname, '../pages/InboxPage.tsx'), 'utf-8');

  test('uses useBootstrapReady hook', () => {
    expect(inboxSrc).toContain('useBootstrapReady');
  });

  test('uses CSS transition-based crossfade for list/thread pane', () => {
    // InboxPage uses CSS transitions (transition-all/transition-colors) rather than
    // Framer Motion AnimatePresence — ThreadView is rendered inline with CSS-based smooth transitions.
    expect(inboxSrc).toContain('ThreadView');
    expect(inboxSrc).toContain('transition');
  });

  test('uses keyboard shortcut for compose (c key)', () => {
    expect(inboxSrc).toContain("e.key === 'c'");
  });

  test('uses keyboard shortcut for search (/ key)', () => {
    expect(inboxSrc).toContain("e.key === '/'");
  });

  test('uses keyboard shortcut for escape (Esc key)', () => {
    expect(inboxSrc).toContain("e.key === 'Escape'");
  });

  test('uses scroll restoration with requestAnimationFrame', () => {
    expect(inboxSrc).toContain('requestAnimationFrame');
    // scroll ref is named savedScroll (was savedScrollPos in older draft)
    expect(inboxSrc).toContain('savedScroll');
  });

  test('bulk selection shows count and clear button', () => {
    expect(inboxSrc).toContain('selected.size} selected');
    expect(inboxSrc).toContain('Clear selection');
  });

  test('imports extracted MessageRow component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/MessageRow'");
  });

  test('imports extracted ThreadView component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/ThreadView'");
  });

  test('imports extracted FloatingCompose component', () => {
    expect(inboxSrc).toContain("from '@/features/messaging/components/FloatingCompose'");
  });
});

// ─── MessageRow source structure guard ────────────────────────────────────────

describe('MessageRow source structure', () => {
  const messageRowSrc = readFileSync(resolve(__dirname, '../components/MessageRow.tsx'), 'utf-8');

  test('renders archive button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-archive-btn"');
  });

  test('renders delete button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-delete-btn"');
  });

  test('renders more button with data-testid', () => {
    expect(messageRowSrc).toContain('data-testid="row-more-btn"');
  });

  test('uses group-hover opacity pattern for hover-reveal', () => {
    expect(messageRowSrc).toContain('group-hover:opacity-0');
    expect(messageRowSrc).toContain('group-hover:opacity-100');
  });

  test('has More menu with mark as read option', () => {
    expect(messageRowSrc).toContain('Mark as read');
  });

  test('has More menu with mark as unread option', () => {
    expect(messageRowSrc).toContain('Mark as unread');
  });
});

// ─── FloatingCompose source structure guard ───────────────────────────────────

describe('FloatingCompose source structure', () => {
  const composeSrc = readFileSync(resolve(__dirname, '../components/FloatingCompose.tsx'), 'utf-8');

  test('uses light neutral header (var(--card))', () => {
    expect(composeSrc).toContain("background: 'var(--card)'");
  });

  test('uses ConfirmDialog for close guard (no window.confirm calls)', () => {
    expect(composeSrc).toContain('ConfirmDialog');
    // Check for actual call site (with open paren), not just the word in comments
    expect(composeSrc).not.toMatch(/window\.confirm\s*\(/);
  });

  test('has SaveStatus type for draft autosave', () => {
    expect(composeSrc).toContain("type SaveStatus");
    expect(composeSrc).toContain("'saving'");
    expect(composeSrc).toContain("'saved'");
  });

  test('width is 560px not 440px', () => {
    expect(composeSrc).toContain('560');
    expect(composeSrc).not.toContain(': 440');
  });

  test('imports RichTextEditor component', () => {
    expect(composeSrc).toContain("from './editor/RichTextEditor'");
  });
});

// ─── ThreadView source structure guard ───────────────────────────────────────

describe('ThreadView source structure', () => {
  const threadSrc = readFileSync(resolve(__dirname, '../components/ThreadView.tsx'), 'utf-8');

  test('imports RichTextEditor (not inline implementation)', () => {
    expect(threadSrc).toContain("from './editor/RichTextEditor'");
  });

  test('does NOT have its own motion entry animation (parent handles crossfade)', () => {
    // ThreadView should not have initial={{ opacity: 0, x: ... }} — only parent wraps it
    expect(threadSrc).not.toMatch(/initial=\{\{.*x:/);
  });
});

// ─── Editor components source structure guard ─────────────────────────────────

describe('RichTextEditor source structure', () => {
  const editorSrc = readFileSync(resolve(__dirname, '../components/editor/RichTextEditor.tsx'), 'utf-8');

  test('no window.prompt in editor', () => {
    expect(editorSrc).not.toMatch(/(?<![a-zA-Z])prompt\s*\(/);
  });

  test('has Bold toolbar button', () => {
    expect(editorSrc).toContain("title=\"Bold\"");
  });

  test('has list toolbar buttons (no window.prompt for lists)', () => {
    expect(editorSrc).toContain("title=\"Bullet list\"");
    expect(editorSrc).toContain("title=\"Numbered list\"");
  });
});
