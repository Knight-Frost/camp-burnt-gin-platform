import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { SmartHintRenderer } from '@/features/guides/components/SmartHintRenderer';
import guideReducer from '@/features/guides/store/guideSlice';
import { authReducer } from '@/features/auth/store/authSlice';
import type { SmartHint } from '@/features/guides/types/guide.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (vars && Object.keys(vars).length > 0) {
        return key + Object.entries(vars).map(([k, v]) => ` ${k}=${String(v)}`).join('');
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

function makeStore() {
  return configureStore({ reducer: { guide: guideReducer, auth: authReducer } });
}

function renderHint(hint: SmartHint) {
  return render(
    <MemoryRouter>
      <Provider store={makeStore()}>
        <SmartHintRenderer hint={hint} />
      </Provider>
    </MemoryRouter>
  );
}

function makeHint(overrides: Partial<SmartHint> = {}): SmartHint {
  return {
    id: 'hint-1',
    messageKey: 'guide.hint.test.message',
    ...overrides,
  };
}

describe('SmartHintRenderer — message rendering', () => {
  test('renders the message i18n key', () => {
    renderHint(makeHint());
    expect(screen.getByText('guide.hint.test.message')).toBeDefined();
  });

  test('renders message with interpolated vars', () => {
    renderHint(makeHint({ messageVars: { count: 3 } }));
    expect(screen.getByText('guide.hint.test.message count=3')).toBeDefined();
  });
});

describe('SmartHintRenderer — CTA button', () => {
  test('renders a CTA button when cta is provided', () => {
    renderHint(
      makeHint({ cta: { labelKey: 'guide.hint.cta.label', pathOverride: '/admin/dashboard' } })
    );
    expect(screen.getByRole('button', { name: 'guide.hint.cta.label' })).toBeDefined();
  });

  test('does not render a CTA button when cta is omitted', () => {
    renderHint(makeHint());
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SmartHintRenderer — severity styling', () => {
  test('urgent hint container uses destructive accent color', () => {
    const { container } = renderHint(makeHint({ severity: 'urgent' }));
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.borderColor).toContain('var(--destructive)');
  });

  test('warning hint container uses warm-amber accent color', () => {
    const { container } = renderHint(makeHint({ severity: 'warning' }));
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.borderColor).toContain('var(--warm-amber)');
  });

  test('info hint container uses ember-orange accent color', () => {
    const { container } = renderHint(makeHint({ severity: 'info' }));
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.borderColor).toContain('var(--ember-orange)');
  });

  test('hint with no severity defaults to ember-orange', () => {
    const { container } = renderHint(makeHint());
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.borderColor).toContain('var(--ember-orange)');
  });
});
