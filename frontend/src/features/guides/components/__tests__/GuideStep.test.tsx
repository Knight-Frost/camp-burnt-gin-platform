import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuideStep } from '@/features/guides/components/GuideStep';
import type { GuideStep as GuideStepType } from '@/features/guides/types/guide.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

function makeStep(overrides: Partial<GuideStepType> = {}): GuideStepType {
  return {
    id: 'step-1',
    titleKey: 'guide.steps.test.title',
    summaryKey: 'guide.steps.test.summary',
    ...overrides,
  };
}

describe('GuideStep — content rendering', () => {
  test('renders the title i18n key', () => {
    render(<GuideStep step={makeStep()} index={0} />);
    expect(screen.getByText('guide.steps.test.title')).toBeDefined();
  });

  test('renders the summary i18n key', () => {
    render(<GuideStep step={makeStep()} index={0} />);
    expect(screen.getByText('guide.steps.test.summary')).toBeDefined();
  });

  test('renders 1-based step number badge matching the index', () => {
    render(<GuideStep step={makeStep()} index={2} />);
    expect(screen.getByText('3')).toBeDefined();
  });
});

describe('GuideStep — details accordion', () => {
  test('renders "More details" trigger when detailsKey is provided', () => {
    render(<GuideStep step={makeStep({ detailsKey: 'guide.steps.test.details' })} index={0} />);
    expect(screen.getByText('guide.more_details_show')).toBeDefined();
  });

  test('does not render "More details" trigger when detailsKey is omitted', () => {
    render(<GuideStep step={makeStep()} index={0} />);
    expect(screen.queryByText('guide.more_details_show')).toBeNull();
  });
});

describe('GuideStep — severity labels', () => {
  test('renders warning label when severity is "warning"', () => {
    render(<GuideStep step={makeStep({ severity: 'warning' })} index={0} />);
    expect(screen.getByText('guide.warning_label')).toBeDefined();
  });

  test('renders urgent label when severity is "urgent"', () => {
    render(<GuideStep step={makeStep({ severity: 'urgent' })} index={0} />);
    expect(screen.getByText('guide.urgent_label')).toBeDefined();
  });

  test('does not render a severity label when severity is "info"', () => {
    render(<GuideStep step={makeStep({ severity: 'info' })} index={0} />);
    expect(screen.queryByText('guide.warning_label')).toBeNull();
    expect(screen.queryByText('guide.urgent_label')).toBeNull();
  });

  test('does not render a severity label when severity is omitted', () => {
    render(<GuideStep step={makeStep()} index={0} />);
    expect(screen.queryByText('guide.warning_label')).toBeNull();
    expect(screen.queryByText('guide.urgent_label')).toBeNull();
  });
});
