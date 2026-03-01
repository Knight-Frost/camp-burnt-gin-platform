# Camp Burnt Gin — System Requirements and Design Reference

This document records the original system requirements, design specifications, and terminology standards established for the Camp Burnt Gin platform. It serves as a historical requirements reference and traceability source.

---

## Table of Contents

1. [System Design Requirements](#1-system-design-requirements)
2. [Inbox System Specification](#2-inbox-system-specification)
3. [Terminology Standard](#3-terminology-standard)
4. [Application Submission System](#4-application-submission-system)
5. [Implementation Status](#5-implementation-status)

---

## 1. System Design Requirements

### 1.1 Core Platform Principles

The Camp Burnt Gin system must:

- Function as a complete replacement for the legacy ReadyOp registration system
- Be HIPAA-conscious and handle Protected Health Information (PHI) securely
- Enforce role-based access control at every architectural layer
- Provide full auditability of all administrative and PHI-access events
- Be production-ready, not demonstration-quality

### 1.2 Original Design Issues (Now Resolved)

The following issues were identified during the initial design phase:

**Issue 1 — Missing Announcement Feature (Applicant Portal)**
The applicant portal did not include an announcement feature. Resolution: `ParentCalendarPage` and the applicant-accessible inbox provide communication from administrative staff.

**Issue 2 — Privileged Self-Deactivation Vulnerability**
The Super Administrator could deactivate their own account. Resolution: `UserManagementPage` enforces a self-modification guard at both the client and API layer.

**Issue 3 — Incomplete Inbox Messaging Features**
File attachments, hyperlinks, embedded images, and rich text formatting were absent. Resolution: `RichTextEditor` (TipTap) provides bold, italic, strikethrough, ordered and unordered lists, and blockquote. File attachment support is deferred.

---

## 2. Inbox System Specification

### 2.1 Overview

The Inbox system must present a modern, structured, and scannable communication interface. The visual design must use the Camp Burnt Gin emerald green accent color and maintain calm, professional aesthetics consistent with the overall application design system.

### 2.2 Layout Structure

The inbox is organized into four vertical sections:

1. Top Control Section — search bar and Compose button
2. Filter Tabs Section — conversation category filters
3. Bulk Action Toolbar — multi-select actions
4. Message List Section — conversation rows

### 2.3 Top Control Section

Required elements:
- Page title: "Inbox"
- Wide, rounded search bar with placeholder: "Search conversations…"
- "+ Compose" button: rounded, solid emerald background, white text, subtle hover effect

### 2.4 Filter Tabs

Required tabs:
- All, Applicants, Medical Team, System, Announcements

Behavior:
- Selected tab: emerald underline or text highlight
- Inactive tabs: gray
- Filter transitions without full page reload

### 2.5 Bulk Action Toolbar

Appears when messages are in selectable state. Required controls:
- Select All checkbox
- Icon buttons: Mark as Read, Archive, Delete, Star, Refresh

### 2.6 Message List Row Structure

Each conversation row (left to right):
1. Checkbox
2. Circular avatar (first initial, soft background color)
3. Content area: sender name (bold), subject line, preview text (gray)
4. Right-aligned: unread indicator dot (emerald), timestamp, category badge

### 2.7 Visual State Indicators

| State | Background | Indicator |
|-------|-----------|-----------|
| Unread | Soft tinted background | Emerald dot, bold sender name |
| Read | White | No dot, normal weight |

| Category | Badge Style |
|----------|------------|
| Applicants | Soft emerald |
| Medical Team | Soft blue |
| System | Neutral gray |
| Announcements | Muted accent |

### 2.8 Interaction Behavior

- Click on row: navigates to conversation, marks as read, removes unread indicator
- Row hover: subtle background highlight, pointer cursor

### 2.9 Design Principles

- Spacious layout with appropriate whitespace
- Minimal visual elements
- Calm, professional aesthetic
- Fully accessible on desktop and mobile viewports
- No visual clutter, no harsh color contrasts

---

## 3. Terminology Standard

### 3.1 Background

Throughout the initial system design and interface, the term "Parent" was used as the primary identifier for individuals submitting applications. This terminology is too narrow and does not accurately reflect the full range of users interacting with the system.

Applications may be completed by parents, legal guardians, foster caregivers, and older campers in applicable cases. The term "Parent" excludes valid user roles and introduces unnecessary ambiguity.

### 3.2 Adopted Standard

**"Applicant"** is the standard system-wide identifier for the role that submits camp applications.

Implementation requirements:
- All interface labels referencing "Parents" are updated to "Applicants"
- Inbox filters, dashboard sections, and communication references use "Applicants"
- Where explanatory context is needed, "Parent/Guardian" may be used in descriptive text
- The backend role identifier remains `parent` for system compatibility
- `ROLE_LABELS.parent` is set to `'Applicant'` in `frontend/src/shared/constants/roles.ts`

---

## 4. Application Submission System

### 4.1 Overview

The Application Submission System must be a fully production-ready replacement for ReadyOp. It must be intuitive, accessible, HIPAA-conscious, fully version-controlled, and fully auditable.

### 4.2 System Capabilities

1. Super Admin and Admin users upload official application forms via the Forms Management module.
2. Applicants can:
   - View the entire application without restriction
   - Navigate freely between sections at any time
   - Save progress automatically (every field change, every 3 seconds, on section exit)
   - Upload required and supplemental documents
   - Submit only when the application is fully complete

**Submission Guard:** An application cannot be submitted unless all required sections are complete, all required documents are uploaded, and all required signatures are provided.

### 4.3 Application Sections

| Section | Title | Key Content |
|---------|-------|-------------|
| 1 | General Information | Camper info, guardians, emergency contact, session request, interpreter |
| 2 | Health and Medical | Insurance, physician, diagnoses, allergies, seizure history, immunizations |
| 3 | Development and Behavior | Behavioral indicators, communication methods, notes |
| 4 | Equipment and Mobility | Assistive devices, transfer requirements, CPAP flag |
| 5 | Diet and Feeding | Special diet, texture modification, fluid restriction, G-tube |
| 6 | Personal Care | Grooming, bathing, toileting, dressing assistance levels |
| 7 | Activities and Permissions | Activity participation authorization |
| 8 | Medications | Dynamic medication cards with dosage and administration |
| 9 | Required Uploads | SC Immunization Certificate, Medical Exam 4523, insurance card, conditional waivers |
| 10 | Consents and Signatures | General consent, photo consent, liability release, drawn or typed signature |

### 4.4 Navigation and UX Requirements

**Free Navigation:**
- Users may open any section at any time
- No forced linear wizard
- Sidebar navigation panel with section status indicators
- Expandable accordion behavior
- Clickable progress map

**Section Status Indicators:**
- Complete
- Partial
- Empty

**Submission Lock Logic:**
- Submit button disabled until: all required fields complete, all uploads present, all consents acknowledged, all signatures completed
- Status display: "Missing [N] required items" or "Application Ready for Submission"

### 4.5 Draft and Auto-Save Behavior

- Auto-save on every field change
- Auto-save every three seconds
- Save on section exit
- Draft stored in localStorage under key `cbg_app_draft`
- Resume from any device (within same browser session)

### 4.6 Validation System

- Real-time field validation (shown after blur or submit attempt)
- Visual highlighting of missing required fields
- Field-level error messages
- Scroll-to-error behavior on submission attempt
- Document upload validation: PDF, JPG, PNG accepted; 10 MB maximum
- Conditional logic enforcement:
  - Seizures = Yes → require Seizure Action Plan upload
  - G-Tube = Yes → require Feeding Action Plan upload
  - CPAP = Yes → require CPAP Waiver upload

### 4.7 Application State Flow

```
Draft → Incomplete → Complete → Submitted → Under Review → Approved / Denied / Waitlisted
```

Medical Review is maintained as a distinct state, separate from Director Review.

### 4.8 Applicant Dashboard Status Indicators

Each application on the applicant dashboard displays one of:

| Status | Meaning |
|--------|---------|
| Draft | In progress, not submitted |
| Incomplete | Missing required items |
| Awaiting Documents | Submitted but documents pending |
| Submitted | Complete submission received |
| Under Medical Review | Medical staff review in progress |
| Approved | Application approved |
| Denied | Application denied |
| Waitlisted | Waitlisted for session |

### 4.9 Admin Forms Management Module

Administrators access a dedicated Forms Management module with the following capabilities:

- Upload new application form PDFs (English and Spanish versions)
- Upload medical forms and waiver templates
- Activate a form version for live use
- Archive previous form versions
- Set registration open and close windows

Forms are stored at `storage/app/form-templates/` via `FormTemplateController`.

### 4.10 Security Requirements

- Role-based access control enforced at every layer
- Encrypted file storage with UUID filenames
- Signed URLs for all document access
- Application version locking after submission
- Comprehensive audit logs for all application actions

### 4.11 Accessibility Requirements

- WCAG AA compliance
- Full keyboard navigation support
- Screen reader labels on all interactive elements
- Spanish language toggle
- Clear section headings and logical tab order
- High contrast mode compatibility

---

## 5. Implementation Status

All requirements defined in this document have been implemented.

| Requirement Area | Status |
|-----------------|--------|
| Inbox system | Complete — see `src/features/messaging/` |
| Terminology standard | Complete — "Applicant" used throughout UI |
| Application form (10 sections) | Complete — see `src/features/parent/pages/ApplicationFormPage.tsx` |
| Submission guard | Complete |
| Auto-save draft | Complete — localStorage `cbg_app_draft` |
| Document uploads | Complete — Section 9 |
| Digital signatures | Complete — Section 10 (drawn + typed) |
| Forms Management module | Complete — `FormManagementPage`, `FormTemplateController` |
| Applicant dashboard statuses | Complete |
| WCAG accessibility | Substantially complete |
| Spanish i18n | Complete |

---

**Document Status:** Authoritative — Requirements Reference
**Last Updated:** March 2026
**Version:** 2.0.0
