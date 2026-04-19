/**
 * social.api.ts — Google OAuth authentication API calls.
 *
 * Flow:
 *  1. getGoogleAuthUrl()        → retrieve the Google consent URL
 *  2. (browser redirects → Google → backend callback → SPA /auth/callback?code=…)
 *  3. exchangeSocialCode(code)  → swap the one-time code for a Sanctum token
 *     OR mfaVerifySocial()     → complete the MFA step after social login
 *     OR confirmSocialLink()   → link an existing account after password verification
 */

import axiosInstance from '@/api/axios.config';
import type { User, ApiResponse } from '@/shared/types';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface SocialAuthSuccessData {
  user: User;
  token: string;
  action: 'login' | 'register';
  just_linked?: boolean;
}

export interface SocialExchangeResponse {
  success: boolean;
  mfa_required?: boolean;
  /** Present only when mfa_required is true */
  mfa_pending_token?: string;
  message?: string;
  data?: SocialAuthSuccessData;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/{provider}/redirect
 *
 * Returns the OAuth provider's authorization URL.
 * The caller should immediately redirect the browser window to this URL.
 */
export async function getSocialAuthUrl(provider: 'google'): Promise<string> {
  const { data } = await axiosInstance.get<{ url: string }>(
    `/auth/${provider}/redirect`
  );
  return data.url;
}

/**
 * POST /api/auth/social/exchange
 *
 * Swap a 30-second one-time code (from the ?code= query param after the OAuth
 * redirect) for the actual auth payload. Burns the code on first use.
 */
export async function exchangeSocialCode(
  code: string
): Promise<SocialExchangeResponse> {
  const { data } = await axiosInstance.post<SocialExchangeResponse>(
    '/auth/social/exchange',
    { code }
  );
  return data;
}

/**
 * POST /api/auth/social/link-confirm
 *
 * Called when a Google account email matches an existing system account.
 * The user supplies their current password to prove they own the account,
 * after which the Google identity is linked and a token is issued.
 */
export async function confirmSocialLink(
  linkToken: string,
  password: string
): Promise<SocialExchangeResponse> {
  const { data } = await axiosInstance.post<SocialExchangeResponse>(
    '/auth/social/link-confirm',
    { link_token: linkToken, password }
  );
  return data;
}

/**
 * POST /api/auth/social/mfa-verify
 *
 * Completes the MFA challenge that follows a social login for users who
 * have TOTP enabled. The mfa_pending_token was issued by the backend and
 * delivered to the SPA via the one-time code exchange.
 */
export async function mfaVerifySocial(
  mfaPendingToken: string,
  mfaCode: string
): Promise<SocialExchangeResponse> {
  const { data } = await axiosInstance.post<SocialExchangeResponse>(
    '/auth/social/mfa-verify',
    { mfa_pending_token: mfaPendingToken, mfa_code: mfaCode }
  );
  return data;
}

/**
 * DELETE /api/auth/social/{provider}
 *
 * Unlinks an OAuth provider from the authenticated user's account.
 * Returns an error if the user would be locked out (no password + no other provider).
 */
export async function unlinkSocialAccount(
  provider: 'google'
): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(
    `/auth/social/${provider}`
  );
  return data;
}

/**
 * POST /api/profile/set-password
 *
 * Allows social-only users (null password) to add password-based login.
 * Once set, the standard change-password flow applies.
 */
export async function setPassword(
  password: string,
  passwordConfirmation: string
): Promise<ApiResponse<{ has_password: boolean }>> {
  const { data } = await axiosInstance.post<ApiResponse<{ has_password: boolean }>>(
    '/profile/set-password',
    { password, password_confirmation: passwordConfirmation }
  );
  return data;
}
