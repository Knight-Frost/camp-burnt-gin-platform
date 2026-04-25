import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GuideButton } from '@/features/guides/components/GuideButton';
import guideReducer, { type GuideState } from '@/features/guides/store/guideSlice';
import { authReducer } from '@/features/auth/store/authSlice';
import { openGuide } from '@/features/guides';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const initialGuideState: GuideState = guideReducer(undefined, { type: '@@INIT' });

function makeStore(guideState?: Partial<GuideState>) {
  return configureStore({
    reducer: { guide: guideReducer, auth: authReducer },
    preloadedState: guideState
      ? { guide: { ...initialGuideState, ...guideState } }
      : undefined,
  });
}

function renderButton(guideState?: Partial<GuideState>) {
  const store = makeStore(guideState);
  const result = render(
    <Provider store={store}>
      <GuideButton />
    </Provider>
  );
  return { ...result, store };
}

describe('GuideButton — rendering', () => {
  test('renders a button element', () => {
    renderButton();
    expect(screen.getByRole('button')).toBeDefined();
  });

  test('button has the correct aria-label from i18n key', () => {
    renderButton();
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'guide.open_button_aria'
    );
  });

  test('aria-expanded reflects guide closed state', () => {
    renderButton({ open: false });
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  test('aria-expanded reflects guide open state', () => {
    renderButton({ open: true, mode: 'page' });
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('GuideButton — interaction', () => {
  test('clicking dispatches openGuide({ mode: "page" })', () => {
    const store = makeStore();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    render(
      <Provider store={store}>
        <GuideButton />
      </Provider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(dispatchSpy).toHaveBeenCalledWith(openGuide({ mode: 'page' }));
  });

  test('clicking sets guide state to open=true after dispatch', () => {
    const { store } = renderButton();
    fireEvent.click(screen.getByRole('button'));
    expect(store.getState().guide.open).toBe(true);
    expect(store.getState().guide.mode).toBe('page');
  });
});
