# Structure Reorganization Report
**Date:** 2026-02-22
**Branch:** frontend

---

## Overview

The frontend source tree was audited and reorganized to enforce a consistent, scalable structure. The primary issue was an inconsistency in page placement: all public pages lived in `src/app/pages/` but the LandingPage lived in `src/features/public/landing/pages/`. Additionally, the router contained five inline placeholder page components rather than proper file-based pages.

---

## Changes Made

### 1. LandingPage relocated

**Before:** `src/features/public/landing/pages/LandingPage.tsx`
**After:** `src/app/pages/LandingPage.tsx`

All public pages now live in one place. The landing page component imports are updated to use absolute path aliases (`@/features/public/landing/components/...`). The now-empty `pages/` directory inside the landing feature was removed.

The barrel file `src/features/public/landing/index.ts` was updated to re-export from the new location for backward compatibility.

### 2. Five inline page stubs promoted to proper files

The router previously contained five inline `() => <div>...</div>` stubs. These were replaced with proper, styled page files:

| File Created | Route | Description |
|-------------|-------|-------------|
| `src/app/pages/LoginPage.tsx` | `/login` | Full login form with HIPAA notice, amber focus states, ember CTA button |
| `src/app/pages/RegisterPage.tsx` | `/register` | Registration form with password strength indicator, match validation |
| `src/app/pages/MfaVerifyPage.tsx` | `/mfa-verify` | 6-digit OTP input with digit-by-digit focus management and paste support |
| `src/app/pages/NotFoundPage.tsx` | `*` | Styled 404 page with ember accent and home navigation |
| `src/app/pages/ForbiddenPage.tsx` | `/forbidden` | Styled 403 page with go-back and home navigation |

### 3. Auth/error routes moved inside PublicLayout

**Before:** `/login`, `/register`, `/mfa-verify`, `/forbidden`, `*` were standalone routes outside `PublicLayout`.

**After:** All routes are now children of `PublicLayout`. This ensures they receive the `LivingBackground` cinematic backdrop, `LandingNav` navigation, and `LandingFooter` consistently across the entire public-facing experience.

### 4. Router simplification

The router was refactored to use a `withSuspense()` helper that wraps lazy-loaded components in a `<Suspense>` boundary with a shared `PageSkeleton`. This eliminated 13 repetitive `<Suspense fallback={...}>` blocks and enforced a single, consistent loading state.

---

## Final src/ Structure

```
frontend/src/
├── api/
│   └── axios.config.ts
├── app/
│   ├── App.tsx
│   ├── ErrorBoundary.tsx
│   ├── components/
│   │   └── ScrollToTop.tsx
│   ├── layouts/
│   │   └── PublicLayout.tsx
│   ├── main.tsx
│   ├── pages/                      (all public pages — unified location)
│   │   ├── LandingPage.tsx         (moved from features/public/landing/pages/)
│   │   ├── AboutPage.tsx
│   │   ├── ApplyPage.tsx
│   │   ├── CampersPage.tsx
│   │   ├── CbgNMePage.tsx
│   │   ├── ForbiddenPage.tsx       (new — replaces inline stub)
│   │   ├── GetInvolvedPage.tsx
│   │   ├── LoginPage.tsx           (new — replaces inline stub)
│   │   ├── MfaVerifyPage.tsx       (new — replaces inline stub)
│   │   ├── NotFoundPage.tsx        (new — replaces inline stub)
│   │   ├── ProgramsPage.tsx
│   │   ├── RegisterPage.tsx        (new — replaces inline stub)
│   │   └── StoriesPage.tsx
│   └── providers.tsx
├── assets/
│   └── styles/
│       ├── design-tokens.css
│       └── globals.css
├── core/
│   ├── auth/
│   │   ├── AuthorityGuard.tsx
│   │   ├── RoleGuard.tsx
│   │   ├── permissionMap.ts
│   │   └── usePermission.ts
│   └── routing/
│       ├── ProtectedRoute.tsx
│       └── index.tsx
├── features/
│   ├── auth/
│   │   ├── hooks/
│   │   │   ├── index.ts
│   │   │   └── useAuthInit.ts
│   │   └── store/
│   │       └── authSlice.ts
│   └── public/
│       └── landing/
│           ├── components/          (11 components — unchanged)
│           ├── hooks/
│           │   └── useTheme.ts
│           └── index.ts             (re-exports LandingPage from new location)
├── shared/
│   ├── constants/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── store/
│   ├── hooks.ts
│   ├── index.ts
│   ├── middleware/
│   │   ├── correlationId.ts
│   │   └── phiProtection.ts
│   └── persistConfig.ts
├── ui/
│   ├── components/                  (Button, Input, Select, Checkbox, Grid, Stack, Container, FullPageLoader)
│   └── layout/                      (AdminLayout, ParentLayout, MedicalLayout, SuperAdminLayout, AuthLayout, AppShell)
└── vite-env.d.ts
```

---

## Result

- All 13 public pages are in `src/app/pages/`
- All named layouts are in `src/ui/layout/`
- The router is 40 lines shorter with the `withSuspense()` helper
- Zero broken imports after the LandingPage relocation
- Zero TypeScript errors (`tsc --noEmit` passes clean)
