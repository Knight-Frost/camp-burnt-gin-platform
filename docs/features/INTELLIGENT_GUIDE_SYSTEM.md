# Intelligent Guide System

**Version:** 1.0
**Last Updated:** April 2026
**Scope:** Frontend feature module `frontend/src/features/guides/` — in-app contextual help, walkthroughs, smart hints, search, and glossary.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [File Map](#3-file-map)
4. [How to Add a New Page Guide](#4-how-to-add-a-new-page-guide)
5. [How to Add a Smart-Hint Resolver](#5-how-to-add-a-smart-hint-resolver)
6. [How to Add a Walkthrough](#6-how-to-add-a-walkthrough)
7. [How to Add a Glossary Term](#7-how-to-add-a-glossary-term)
8. [Role-Based Filtering](#8-role-based-filtering)
9. [Page Detection — Route Matching](#9-page-detection--route-matching)
10. [i18n Key Conventions](#10-i18n-key-conventions)
11. [Testing](#11-testing)
12. [Keeping Help Content Synchronized with UI Changes](#12-keeping-help-content-synchronized-with-ui-changes)
13. [Future Expansion](#13-future-expansion)
14. [File Ownership Matrix](#14-file-ownership-matrix)
15. [HIPAA Reminder](#15-hipaa-reminder)
16. [Auto Guide Toggle (Environment Control)](#16-auto-guide-toggle-environment-control)

---

## 1. Overview

The Intelligent Guide System is the in-app help layer built into every portal page. When a user clicks the Help button in the top navigation bar, a slide-over panel opens and shows context-aware content for the current page and the user's role: a plain-language page summary, step-by-step guidance, an FAQ accordion, smart next-step hints that query live data, and a "Take the tour" walkthrough that overlays the actual UI. The Help Center modal (reachable from the same button) provides full-text search across all guides, a browsable index grouped by role, and a Glossary tab.

**What it is not:**

- Not a CMS-driven help portal. All content lives in TypeScript modules in the repository and is deployed with the application.
- Not an analytics or telemetry system. The system renders help content; it does not track which guides are read or how long panels stay open (hooks exist for a future opt-in telemetry layer — see Section 13).
- Not a conversational Q&A interface. The FAQ accordion and search are static; answers are written by the development team and stored as i18n strings.

---

## 2. Architecture Summary

The system is a single self-contained feature module at `frontend/src/features/guides/`. Nothing outside this directory is modified to add or change help content.

**Foundation layer**

- `types/guide.types.ts` — all TypeScript interfaces: `GuideEntry`, `WalkthroughStep`, `Walkthrough`, `GuideFaqItem`, `SmartHint`, `GlossaryTerm`.
- `registry/guideRegistry.ts` — an in-memory registry populated at module load. Exposes `registerGuide`, `getGuide`, `getGuidesForRole`, `getWalkthrough`, `registerGlossaryTerm`, `getGlossaryTerms`, and `__resetGuideRegistry` (for tests).
- `registry/smartHintRegistry.ts` — a parallel registry keyed by route key. Exposes `registerSmartHintResolver` and `getSmartHintResolver`.
- `store/guideSlice.ts` — Redux Toolkit slice that tracks whether the panel is open, the current mode (`closed | page | help-center | walkthrough`), the active step index, the active walkthrough ID, and the first-time auto-guide surface (dormant — see Section 13).
- `utils/routeMatcher.ts` — converts `window.location.pathname` to a `ROUTES` constant key by building regex matchers from the `ROUTES` map at first call, sorting by specificity, and caching the result.

**UI layer**

- `GuideButton` — the book-icon button mounted in `DashboardHeader`. Dispatches `openGuide({ mode: 'page' })`.
- `GuidePanel` — the slide-over panel mounted in `DashboardShell`. Reads the current route key and the user's role from the Redux store, calls `getGuide(routeKey, role)`, and renders the matching `GuideEntry`. Conditionally shows a "Take the tour" button when the entry has a `walkthrough` property.
- `GuideWalkthrough` — overlay engine. When `mode === 'walkthrough'`, it reads the active `Walkthrough`, finds each `anchorId` in the DOM via `data-guide-anchor`, computes the anchor element's position, and renders `GuideCoachmark` positioned relative to it.
- `HelpCenterModal` — full-text search, role-grouped index, and Glossary tab.
- `SmartHintRenderer` — renders a `SmartHint` object as a colored banner with optional CTA button. Imported and used directly by smart-hint resolver components.
- `SmartNextStepCard` — wraps `SmartHintRenderer` inside the guide panel.

**Content layer**

TypeScript modules under `content/<role>/<page>.tsx` call `registerGuide(...)` and optionally `registerSmartHintResolver(...)` at module-load time (side-effect imports). The barrel `content/index.ts` imports all role sub-barrels plus the glossary module. This barrel is imported once in `main.tsx` so the entire content set is registered before any component renders.

**i18n**

Guide UI label strings live in `frontend/src/i18n/guides/en.json` and `es.json`, merged under the `guide.*` namespace at i18n init. Per-role content strings live in `frontend/src/i18n/guides/content/<role>.{en,es}.json`, also merged at init. Glossary strings live in `frontend/src/i18n/guides/content/glossary.{en,es}.json`.

---

## 3. File Map

```
frontend/src/features/guides/
  index.ts                          Public barrel — re-exports everything consumers need
  types/
    guide.types.ts                  All TS interfaces for guides
  registry/
    guideRegistry.ts                registerGuide, getGuide, getGuidesForRole, etc.
    smartHintRegistry.ts            registerSmartHintResolver, getSmartHintResolver
  store/
    guideSlice.ts                   Redux slice (open/close, walkthrough, first-time surface)
  utils/
    routeMatcher.ts                 matchRouteKey(pathname) → ROUTES constant key
    __tests__/
      routeMatcher.test.ts          Route matcher unit tests
  hooks/
    useGuideForRoute.ts             Convenience hook: current guide for authenticated user
    useGuideSearch.ts               Full-text search over allGuides
    useAnchorElement.ts             Resolves data-guide-anchor to a DOM Rect
  components/
    GuideButton.tsx                 Book-icon button (mounts in DashboardHeader)
    GuidePanel.tsx                  Slide-over panel (mounts in DashboardShell)
    GuideStep.tsx                   Individual step row inside GuidePanel
    GuideWalkthrough.tsx            DOM overlay engine
    GuideCoachmark.tsx              Positioned tooltip rendered per walkthrough step
    HelpCenterModal.tsx             Full modal: search + index + glossary
    SmartHintRenderer.tsx           Renders SmartHint as a colored banner
    SmartNextStepCard.tsx           Wraps SmartHintRenderer inside GuidePanel
    GlossaryView.tsx                Glossary tab content inside HelpCenterModal
  content/
    index.ts                        Root barrel — import this once in main.tsx
    glossary.ts                     registerGlossaryTerm calls for all 23 terms
    applicant/
      index.ts                      Side-effect barrel for applicant guides
      dashboard.tsx                 Guide + smart-hint resolver for applicant dashboard
      applicationForm.tsx
      applicationDetail.tsx
      documents.tsx
      inbox.tsx
    admin/
      index.ts
      dashboard.tsx
      applicationReview.tsx
      documentQueue.tsx
      sessions.tsx
      reports.tsx
    superAdmin/
      index.ts
      dashboard.tsx
      userManagement.tsx
      auditLog.tsx
    medical/
      index.ts
      dashboard.tsx
      camperRecord.tsx
      treatments.tsx
    shared/
      index.ts
      inbox.tsx                     Guide shared across roles for the inbox page
      profile.tsx
      settings.tsx
    resolvers/
      _examples.ts                  Non-registering pattern reference — not imported

frontend/src/i18n/guides/
  en.json                           Guide UI label strings (English)
  es.json                           Guide UI label strings (Spanish)
  content/
    applicant.en.json
    applicant.es.json
    admin.en.json
    admin.es.json
    superAdmin.en.json
    superAdmin.es.json
    medical.en.json
    medical.es.json
    shared.en.json
    shared.es.json
    glossary.en.json
    glossary.es.json
```

**Where to add what:**

| Task | File(s) to create or edit |
|---|---|
| New guide for existing role + page | New `content/<role>/<page>.tsx`; add import to `content/<role>/index.ts`; add i18n keys |
| New guide for a new role | New `content/<newRole>/` directory with `index.ts` barrel; import barrel in `content/index.ts` |
| New smart-hint resolver | Add `registerSmartHintResolver(...)` call inside the guide content file for that page |
| New walkthrough step | Add `data-guide-anchor` to the page component; add step to `walkthrough.steps` in the guide entry |
| New glossary term | Append to `TERMS` array in `content/glossary.ts`; add i18n keys to both glossary JSON files |

---

## 4. How to Add a New Page Guide

### Prerequisites

- You know the route key for the page. Find it in `frontend/src/shared/constants/routes.ts` (e.g., `MEDICAL_DIRECTORY`).
- You know the target role: `applicant`, `admin`, `super_admin`, or `medical`.

### Steps

**Step 1.** Create the content file.

```
frontend/src/features/guides/content/<role>/<page>.tsx
```

**Step 2.** In the new file, import `registerGuide` and call it at module-load time (not inside a component or hook).

```typescript
// frontend/src/features/guides/content/medical/directory.tsx
import { registerGuide } from '@/features/guides';

registerGuide({
  id: 'medical.directory',
  role: 'medical',
  routeKeys: ['MEDICAL_DIRECTORY'],
  titleKey: 'guide.medical.directory.title',
  summaryKey: 'guide.medical.directory.summary',
  steps: [
    {
      id: 'search',
      titleKey: 'guide.medical.directory.steps.search.title',
      summaryKey: 'guide.medical.directory.steps.search.summary',
      detailsKey: 'guide.medical.directory.steps.search.details',
    },
    {
      id: 'filters',
      titleKey: 'guide.medical.directory.steps.filters.title',
      summaryKey: 'guide.medical.directory.steps.filters.summary',
    },
  ],
  faq: [
    {
      id: 'inactive_campers',
      questionKey: 'guide.medical.directory.faq.inactive_campers.question',
      answerKey: 'guide.medical.directory.faq.inactive_campers.answer',
    },
  ],
});
```

**Step 3.** Add a side-effect import to the role barrel.

```typescript
// frontend/src/features/guides/content/medical/index.ts  (existing file)
import './dashboard';
import './camperRecord';
import './treatments';
import './directory';     // <-- add this line
```

**Step 4.** Add all i18n keys to both the English and Spanish content files.

```jsonc
// frontend/src/i18n/guides/content/medical.en.json  (add inside the existing object)
"medical": {
  "directory": {
    "title": "Camper Directory",
    "summary": "Find enrolled campers and access their health records.",
    "steps": {
      "search": {
        "title": "Search by name",
        "summary": "Type any part of a camper's name to filter the list.",
        "details": "The search is case-insensitive and matches on first name, last name, and preferred name."
      },
      "filters": {
        "title": "Filter by session",
        "summary": "Use the session dropdown to limit results to one camp session."
      }
    },
    "faq": {
      "inactive_campers": {
        "question": "Why is a camper missing from the directory?",
        "answer": "Only campers with an approved application are shown. If a camper's application is pending review, they will not appear here yet."
      }
    }
  }
}
```

Add matching keys to `medical.es.json` with formal "usted" Spanish translations.

**Step 5.** Verify.

```bash
npm run type-check && npm run lint
```

The guide panel will now show the correct content whenever a `medical` role user visits the directory page.

---

## 5. How to Add a Smart-Hint Resolver

A smart-hint resolver is a React functional component that fetches live data and conditionally returns a `SmartHintRenderer` banner. It only mounts when the guide panel is open, so data fetches do not run on every page load.

### Steps

**Step 1.** Inside the guide content file for the target page, write the resolver component.

```typescript
// At the bottom of frontend/src/features/guides/content/medical/directory.tsx
import { useEffect, useState } from 'react';
import {
  registerSmartHintResolver,
  SmartHintRenderer,
} from '@/features/guides';
import { getCampers } from '@/features/medical/api/medical.api';

function MedicalDirectoryHint() {
  const [unreviewed, setUnreviewed] = useState(0);

  useEffect(() => {
    getCampers({ flagged: true })
      .then((list) => setUnreviewed(list.length))
      .catch(() => setUnreviewed(0));
  }, []);

  if (unreviewed === 0) return null;

  return (
    <SmartHintRenderer
      hint={{
        id: 'medical.directory.flagged_campers',
        messageKey: 'guide.medical.directory.hint.flagged.message',
        messageVars: { count: unreviewed },
        severity: 'warning',
        cta: {
          labelKey: 'guide.medical.directory.hint.flagged.cta',
          routeKey: 'MEDICAL_CAMPER_RECORDS',
        },
      }}
    />
  );
}

registerSmartHintResolver('MEDICAL_DIRECTORY', MedicalDirectoryHint);
```

**Step 2.** Add the hint i18n keys to both `medical.en.json` and `medical.es.json`.

```jsonc
"hint": {
  "flagged": {
    "message": "{{count}} camper(s) have flagged health notes requiring attention.",
    "cta": "View camper records"
  }
}
```

**Step 3.** Set `smartHints: true` in the `registerGuide` call for this page. The guide panel reads this flag to know it should mount the resolver.

The resolver receives no props. Use `useAppSelector` or direct API calls for any data you need. Always provide a `.catch()` path that returns a default value so a failing API call does not leave the panel in a broken state.

---

## 6. How to Add a Walkthrough

A walkthrough is a step-by-step overlay that highlights real elements on the page using `data-guide-anchor` attributes as anchor points.

### Step 1. Add data-guide-anchor attributes to the target page

In the page component, add the attribute to each element the tour should highlight. Use the naming pattern `<page>.<element>`.

```tsx
// Example: inside MedicalDirectoryPage.tsx
<input
  type="search"
  data-guide-anchor="medical-directory.search-input"
  ...
/>

<div
  data-guide-anchor="medical-directory.session-filter"
  ...
>
```

No other changes are needed to the page component.

### Step 2. Add the walkthrough property to the registerGuide call

```typescript
registerGuide({
  id: 'medical.directory',
  role: 'medical',
  routeKeys: ['MEDICAL_DIRECTORY'],
  titleKey: 'guide.medical.directory.title',
  summaryKey: 'guide.medical.directory.summary',
  steps: [ /* ... */ ],
  walkthrough: {
    id: 'walkthrough.medical.directory',
    titleKey: 'guide.medical.directory.walkthrough.title',
    steps: [
      {
        id: 'search',
        anchorId: 'medical-directory.search-input',
        titleKey: 'guide.medical.directory.walkthrough.steps.search.title',
        bodyKey: 'guide.medical.directory.walkthrough.steps.search.body',
        position: 'bottom',
      },
      {
        id: 'filter',
        anchorId: 'medical-directory.session-filter',
        titleKey: 'guide.medical.directory.walkthrough.steps.filter.title',
        bodyKey: 'guide.medical.directory.walkthrough.steps.filter.body',
        position: 'right',
      },
    ],
  },
});
```

Valid `position` values: `top`, `bottom`, `left`, `right`, `auto`. Use `auto` when the element may appear near a viewport edge.

### Step 3. Add the walkthrough i18n keys

```jsonc
// medical.en.json
"walkthrough": {
  "title": "Tour: Camper Directory",
  "steps": {
    "search": {
      "title": "Search by name",
      "body": "Type any part of a camper's name. Results update as you type."
    },
    "filter": {
      "title": "Filter by session",
      "body": "Limit the list to one camp session using this dropdown."
    }
  }
}
```

Add matching keys to `medical.es.json`.

### Step 4. No additional wiring needed

The "Take the tour" button appears automatically in the guide panel for any `GuideEntry` that has a `walkthrough` property. Clicking it dispatches `startWalkthrough({ walkthroughId: 'walkthrough.medical.directory' })` and `GuideWalkthrough` takes over.

---

## 7. How to Add a Glossary Term

**Step 1.** Open `frontend/src/features/guides/content/glossary.ts`.

**Step 2.** Append an entry to the `TERMS` array.

```typescript
{ id: 'glossary.session_status', termKey: 'guide.glossary.session_status.term', definitionKey: 'guide.glossary.session_status.definition' },
```

**Step 3.** Add the keys to both glossary JSON files.

```jsonc
// frontend/src/i18n/guides/content/glossary.en.json
"session_status": {
  "term": "Session Status",
  "definition": "The operational state of a camp session. Possible values are Open, Waitlist, Closed, and Cancelled."
}
```

```jsonc
// frontend/src/i18n/guides/content/glossary.es.json
"session_status": {
  "term": "Estado de la sesión",
  "definition": "El estado operativo de una sesión de campamento. Los valores posibles son Abierta, Lista de espera, Cerrada y Cancelada."
}
```

**Step 4.** Done. The Glossary tab in the Help Center picks it up automatically on next render. Terms are sorted alphabetically by `termKey` at display time.

---

## 8. Role-Based Filtering

`registerGuide` accepts `role: RoleName | RoleName[]`. A guide registered with a single role is returned only for that role. A guide registered with an array is returned for any role in the array.

```typescript
// Shared inbox guide visible to all roles
registerGuide({
  id: 'shared.inbox',
  role: ['applicant', 'admin', 'super_admin', 'medical'],
  routeKeys: ['INBOX', 'PARENT_INBOX'],
  ...
});
```

**Lookup:** `getGuide(routeKey, role)` returns the `GuideEntry` registered for that exact `(routeKey, role)` pair, or `null` if none exists. The guide panel calls this on every render with the current route key and the authenticated user's role; no content from a different role is ever exposed.

**Help Center index:** `getGuidesForRole(role)` returns all `GuideEntry` objects visible to that role, used to populate the browsable guide index in `HelpCenterModal`.

---

## 9. Page Detection — Route Matching

`matchRouteKey(pathname)` in `utils/routeMatcher.ts` converts a URL pathname to a `ROUTES` constant key.

**How it works:**

1. On first call, it iterates `Object.entries(ROUTES)` from `frontend/src/shared/constants/routes.ts`.
2. For string values, the path is used directly. For function values (dynamic routes), the function is called with the placeholder `'__id__'` to produce a representative path string.
3. Each path is converted to a regex: path separators are escaped, `__id__` segments become `[^/]+`.
4. Matchers are sorted by specificity (deeper paths rank higher; dynamic segments reduce score). The sorted list is cached after the first call.
5. On each subsequent call, the pathname is matched against the sorted list and the key of the first match is returned.

**To add a new route:** add the constant to `frontend/src/shared/constants/routes.ts` and use it as the `routeKey` value in your `registerGuide` call. The matcher will pick it up automatically without any changes to the guide system.

**Dynamic routes** (e.g., `/admin/applications/:id`) work because the function form is called with `'__id__'` to produce `/admin/applications/__id__`, which becomes the regex `/^\/admin\/applications\/[^/]+\/?$/`. Any real pathname with a valid ID will match.

---

## 10. i18n Key Conventions

All guide strings follow a flat key hierarchy inside their respective JSON files. The key structures are:

### UI labels (`i18n/guides/en.json`, `i18n/guides/es.json`)

These are the shell strings used by `GuidePanel`, `HelpCenterModal`, and walkthrough navigation buttons.

```
guide.next
guide.previous
guide.close
guide.take_the_tour
guide.help_center_title
guide.search_placeholder
guide.glossary_tab
guide.smart_next_step_empty
guide.faq_tab
guide.steps_tab
```

### Per-role content (`i18n/guides/content/<role>.{en,es}.json`)

```
guide.<role>.<page>.title
guide.<role>.<page>.summary
guide.<role>.<page>.steps.<stepId>.title
guide.<role>.<page>.steps.<stepId>.summary
guide.<role>.<page>.steps.<stepId>.details        (optional)
guide.<role>.<page>.faq.<faqId>.question
guide.<role>.<page>.faq.<faqId>.answer
guide.<role>.<page>.hint.<hintId>.message
guide.<role>.<page>.hint.<hintId>.cta
guide.<role>.<page>.walkthrough.title
guide.<role>.<page>.walkthrough.steps.<stepId>.title
guide.<role>.<page>.walkthrough.steps.<stepId>.body
```

### Glossary (`i18n/guides/content/glossary.{en,es}.json`)

```
guide.glossary.<termId>.term
guide.glossary.<termId>.definition
```

### Spanish translation requirements

- All Spanish translations must use formal "usted" address consistent with `frontend/src/i18n/es.json`.
- Key parity between English and Spanish files is required. The `npm run type-check` step does not validate i18n key parity, so verify manually when adding keys.
- Use only synthetic names in example content (Alex Rivera, Jordan Lee, Sam Patel).

---

## 11. Testing

Tests for the guide system machinery live colocated with the source under `__tests__/` directories, following the project convention for all other features.

### Running guide tests

```bash
# From frontend/
npm run test -- run
```

### What to test

Test the machinery. Do not test content strings — they change too often and tests that assert specific user-facing copy become maintenance debt.

| Subject | What to assert |
|---|---|
| Guide registry | `registerGuide` → `getGuide` returns the entry; wrong role returns null; `getGuidesForRole` returns correct subset |
| Glossary registry | `registerGlossaryTerm` → `getGlossaryTerms` returns sorted list |
| Route matcher | Known static routes match their key; dynamic routes match with real-looking IDs; unknown paths return null |
| Guide slice | `openGuide`, `closeGuide`, `startWalkthrough`, `exitWalkthrough` produce correct state transitions |
| Registry isolation | `__resetGuideRegistry()` and `__resetSmartHintRegistry()` clear state between tests |

### Test store setup for component tests

Guide components require a Redux store. Use a minimal test store with only `guideReducer`:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import guideReducer from '@/features/guides';

const testStore = configureStore({
  reducer: { guide: guideReducer },
});
```

### Registry isolation

Always call `__resetGuideRegistry()` and `__resetSmartHintRegistry()` in `beforeEach` for any test that calls `registerGuide` or `registerSmartHintResolver`. Without this, registrations from one test bleed into others.

```typescript
import {
  __resetGuideRegistry,
} from '@/features/guides/registry/guideRegistry';
import {
  __resetSmartHintRegistry,
} from '@/features/guides/registry/smartHintRegistry';

beforeEach(() => {
  __resetGuideRegistry();
  __resetSmartHintRegistry();
});
```

---

## 12. Keeping Help Content Synchronized with UI Changes

**When you rename a route constant:**
Search content files for the old constant name and update every `routeKeys` array that references it. The route matcher will silently return `null` for an unmatched pathname, causing the guide panel to show nothing — with no error in the console.

```bash
grep -r "OLD_ROUTE_KEY" frontend/src/features/guides/content/
```

**When you rename or remove a `data-guide-anchor` attribute:**
Search content files for the old anchor ID and update or remove the corresponding `WalkthroughStep.anchorId`. A missing anchor causes the `GuideWalkthrough` to skip that step silently. The tour still runs but the highlighted element is absent.

```bash
grep -r "old-anchor-id" frontend/src/features/guides/content/
```

**When you add a new page or major feature:**
Add a guide for it as part of the same pull request — not in a separate cleanup PR. A page that silently shows no guide content is a gap in the user experience, and deferred guide work is frequently never completed.

**When you remove a page:**
Remove the guide content file, the import from the role barrel, and the i18n keys. Orphaned i18n keys are harmless but accumulate noise. Orphaned content files with `registerGuide` calls cause phantom guide entries in `getGuidesForRole` results.

**Spanish parity:**
When you add or update English keys, update the Spanish counterpart in the same commit. Diverged key sets are not caught at build time.

---

## 13. Future Expansion

These capabilities are designed into the system architecture but not yet active. This list is prescriptive: if you activate one of these items, implement it as described here so it remains consistent with the rest of the system.

- **PDF export.** Print-styled rendering of all guides for a given role (e.g., a printable staff orientation packet). Deferred until product requests it. Implementation path: add a `printGuideSet(role)` function that calls `getGuidesForRole(role)` and renders a print-stylesheet-aware React tree, then triggers `window.print()`.

- **Video walkthroughs.** Per-step video URLs could be added to `WalkthroughStep` as an optional `videoUrl?: string` field. Deferred pending content creation workflow. No backend changes are needed.

- **Telemetry.** An optional `POST /api/guide-events` endpoint for "guide opened", "walkthrough completed", and "hint clicked" events would provide usage data to justify content investment. The backend endpoint does not exist yet. When built, telemetry calls should be fire-and-forget (no await, no error display to the user) and must not include any PHI.

- **First-time auto-launch.** Activated and gated by the `VITE_AUTO_GUIDE` environment variable — see section 16 below. Per-user `localStorage` persistence of `seenGuides` is the remaining tightening: today the seen flag lives in Redux only, so a fresh browser session re-arms auto-launch. To add persistence, hydrate `seenGuides` from `localStorage` (keyed by the logged-in user ID) inside `main.tsx` after the auth user is known, and write back on every `markGuideSeen` action via a small store subscriber.

---

## 14. File Ownership Matrix

All files below were created as part of the Intelligent Guide System build (Waves 1 through 6). No files outside `frontend/src/features/guides/`, `frontend/src/i18n/guides/`, and this documentation file were modified.

| File | Wave | Status |
|---|---|---|
| `types/guide.types.ts` | Wave 1 | Foundation |
| `registry/guideRegistry.ts` | Wave 1 | Foundation |
| `registry/smartHintRegistry.ts` | Wave 1 | Foundation |
| `store/guideSlice.ts` | Wave 1 | Foundation |
| `utils/routeMatcher.ts` | Wave 1 | Foundation |
| `index.ts` (feature barrel) | Wave 1 | Foundation |
| `components/GuideButton.tsx` | Wave 2A | Core UI |
| `components/GuidePanel.tsx` | Wave 2A | Core UI |
| `components/GuideStep.tsx` | Wave 2A | Core UI |
| `components/SmartHintRenderer.tsx` | Wave 2A | Core UI |
| `components/SmartNextStepCard.tsx` | Wave 2A | Core UI |
| `components/HelpCenterModal.tsx` | Wave 2A | Core UI |
| `components/GlossaryView.tsx` | Wave 2A | Core UI |
| `components/GuideWalkthrough.tsx` | Wave 2B | Walkthrough engine |
| `components/GuideCoachmark.tsx` | Wave 2B | Walkthrough engine |
| `hooks/useGuideForRoute.ts` | Wave 2B | Walkthrough engine |
| `hooks/useGuideSearch.ts` | Wave 2B | Walkthrough engine |
| `hooks/useAnchorElement.ts` | Wave 2B | Walkthrough engine |
| `content/applicant/dashboard.tsx` | Wave 3A | Applicant content |
| `content/applicant/applicationForm.tsx` | Wave 3A | Applicant content |
| `content/applicant/applicationDetail.tsx` | Wave 3A | Applicant content |
| `content/applicant/documents.tsx` | Wave 3A | Applicant content |
| `content/applicant/inbox.tsx` | Wave 3A | Applicant content |
| `content/applicant/index.ts` | Wave 3A | Applicant content |
| `content/admin/dashboard.tsx` | Wave 3B | Admin content |
| `content/admin/applicationReview.tsx` | Wave 3B | Admin content |
| `content/admin/documentQueue.tsx` | Wave 3B | Admin content |
| `content/admin/sessions.tsx` | Wave 3B | Admin content |
| `content/admin/reports.tsx` | Wave 3B | Admin content |
| `content/admin/index.ts` | Wave 3B | Admin content |
| `content/superAdmin/dashboard.tsx` | Wave 3B | Admin content |
| `content/superAdmin/userManagement.tsx` | Wave 3B | Admin content |
| `content/superAdmin/auditLog.tsx` | Wave 3B | Admin content |
| `content/superAdmin/index.ts` | Wave 3B | Admin content |
| `content/medical/dashboard.tsx` | Wave 3C | Medical content |
| `content/medical/camperRecord.tsx` | Wave 3C | Medical content |
| `content/medical/treatments.tsx` | Wave 3C | Medical content |
| `content/medical/index.ts` | Wave 3C | Medical content |
| `content/shared/inbox.tsx` | Wave 3C | Shared content |
| `content/shared/profile.tsx` | Wave 3C | Shared content |
| `content/shared/settings.tsx` | Wave 3C | Shared content |
| `content/shared/index.ts` | Wave 3C | Shared content |
| `content/glossary.ts` | Wave 3C | Shared content |
| `content/resolvers/_examples.ts` | Wave 3C | Pattern reference |
| `content/index.ts` | Wave 3C | Root barrel |
| `data-guide-anchor` attrs (applicant pages) | Wave 4A | Page wiring |
| `data-guide-anchor` attrs (admin pages) | Wave 4B | Page wiring |
| `utils/__tests__/routeMatcher.test.ts` | Wave 5 | Tests |
| `frontend/src/i18n/guides/**` | Waves 1–3C | i18n content |
| `docs/features/INTELLIGENT_GUIDE_SYSTEM.md` | Wave 6 | Documentation |

---

## 15. HIPAA Reminder

Guide content is part of the deployed application and is subject to the same HIPAA policies as the rest of the codebase. Content files must use only synthetic names when constructing example scenarios — use Alex Rivera, Jordan Lee, or Sam Patel. Never include real camper names, dates of birth, diagnoses, medications, or any other Protected Health Information in guide text, i18n strings, FAQ answers, or smart-hint messages. Never use real data screenshots or screen recordings in walkthrough step descriptions. If you inherit a content file that contains real PHI, treat it as an incident and follow `workflows/incident-response-workflow.md` before committing any changes to that file.

---

---

## 16. Auto Guide Toggle (Environment Control)

The first-time auto-launch behavior is gated by a single environment variable: `VITE_AUTO_GUIDE`. When set to `"true"`, any guide tagged with `autoLaunchOnFirstVisit: true` will open automatically the first time a user visits its route within a browser session, then mark itself seen so it does not re-open.

**Values:**

- `VITE_AUTO_GUIDE=true` — auto-launch enabled
- `VITE_AUTO_GUIDE=false` — auto-launch disabled (default)
- Variable missing — treated as `false`

**Where to set it:** `frontend/.env`, `frontend/.env.local`, or `frontend/.env.production` depending on the target environment. The variable is also listed in `frontend/.env.example` under "Feature Flags".

**Restart required:** Vite inlines `import.meta.env.*` at dev-server start and at build time. Any change to `VITE_AUTO_GUIDE` requires a restart of the dev server (`npm run dev`) or a fresh `npm run build` to take effect.

**Implementation point:** `frontend/src/features/guides/components/GuidePanel.tsx` reads the variable into a module-level constant `AUTO_GUIDE_ENABLED` and short-circuits the auto-launch `useEffect` when it is false. Manual guide opening, the Help Center, the walkthrough engine, and role/page filtering are unaffected by this toggle.

**Scope today:** Only the applicant dashboard and admin dashboard guides are tagged `autoLaunchOnFirstVisit: true`. To make additional guides auto-launch, add the flag to their `registerGuide({...})` call — no other code change is required.

**Known limitation:** `seenGuides` lives in Redux only, not in `localStorage`. A guide marked seen during one browser session will be re-eligible for auto-launch in a fresh session. Per-user persistence is the next tightening — see section 13.

---

**Document Status:** Authoritative
**Last Updated:** April 2026
**Version:** 1.1
