/**
 * Session Configuration
 * Static session data for landing page
 * Updated per registration cycle
 */

export interface SessionConfig {
  id: number;
  name: string;
  dates: string;
  ageRange: string;
  eligibility: string;
  availability: 'open' | 'limited' | 'waitlist' | 'full';
}

export const SESSIONS: SessionConfig[] = [
  {
    id: 1,
    name: 'Summer Session A',
    dates: 'June 9–14, 2026',
    ageRange: '7–16',
    eligibility: 'Children with special health care needs',
    availability: 'open',
  },
  {
    id: 2,
    name: 'Summer Session B',
    dates: 'June 16–21, 2026',
    ageRange: '7–16',
    eligibility: 'Children with special health care needs',
    availability: 'limited',
  },
  {
    id: 3,
    name: 'Summer Session C',
    dates: 'June 23–28, 2026',
    ageRange: '7–16',
    eligibility: 'Children with special health care needs',
    availability: 'open',
  },
];
