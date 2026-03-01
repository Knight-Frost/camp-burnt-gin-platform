# Camp Burnt Gin — System Design & Requirements Documentation

---

## Table of Contents

1. [Issue Log](#issue-log)
2. [Inbox System Specification](#inbox-system-specification)
3. [Terminology Standard](#terminology-standard)
4. [Application Submission System](#application-submission-system)

---

## Issue Log

### Issue 1 — Missing Announcement Feature (Parent Portal)

The parent portal does not currently include an announcement feature. Applicants are unable to receive announcements originating from Admin or Super Admin accounts. This feature must be implemented to ensure proper top-down communication within the system.

---

### Issue 2 — Privileged Self-Deactivation Vulnerability

The system currently permits a Super Administrator to deactivate their own account. This constitutes a critical authorization flaw. Specifically, it introduces a privileged self-deactivation vulnerability that could leave the system without any active top-level administrator.

This behavior violates role integrity and proper Role-Based Access Control (RBAC) security design principles. A Super Administrator account must be protected from self-deactivation at the system level. This restriction should be enforced server-side and cannot be bypassed through the user interface.

---

### Issue 3 — Incomplete Inbox Messaging Features

The current inbox implementation is missing essential messaging features that are standard in any modern communication system. Users are currently unable to:

- Attach files to messages
- Insert hyperlinks
- Embed images
- Apply rich text formatting (bold, italics, ordered and unordered lists, emoji support)

These missing capabilities significantly limit the functional utility of the inbox and are inconsistent with the originally specified Gmail-level messaging experience. These features must be implemented in full.

---

## Inbox System Specification

### Overview

The Inbox system must be clean, structured, and easy to scan at a glance. It must feel modern, calm, and organized, with clear visual hierarchy and green accent highlights consistent with the Camp Burnt Gin brand identity.

---

### 1. Overall Layout

The Inbox must occupy a full-width content area with generous spacing and soft rounded corners. It must be divided vertically into the following four sections:

1. Top Control Section (Search and Actions)
2. Filter Tabs Section
3. Bulk Action Toolbar
4. Message List Section

All sections must be visually aligned, evenly spaced, and balanced.

---

### 2. Top Control Section

The top of the page must display the following elements:

- A large page title reading "Inbox"
- A wide, rounded search bar with placeholder text: "Search conversations..."
- To the right of the search bar, a clearly visible "+ Compose" button styled as follows:
  - Rounded edges
  - Solid green background
  - White text
  - Subtle hover effect

This section must remain simple and free of visual clutter.

---

### 3. Filter Tabs

Directly below the search bar, a row of horizontal filter tabs must be displayed. The required tabs are:

- All
- Applicants
- Medical Team
- System
- Announcements

**Behavior:**

- The selected tab must display a green underline or green text highlight.
- Inactive tabs must render in gray.
- Tab filtering must occur without a full page reload.

**Optional:** A "Sort: Newest" dropdown may be placed on the right side of the tab row.

---

### 4. Bulk Action Toolbar

A slim action toolbar must appear above the message list when messages are in a selectable state. This toolbar must include:

- A "Select All" checkbox
- Icon buttons for the following actions:
  - Mark as Read
  - Archive
  - Delete
  - Star
  - Refresh

Icons must render in subtle gray by default and darken slightly on hover.

---

### 5. Message List Design

Each message must render as a horizontal card-style row with soft visual separation between rows.

**Row structure (left to right):**

1. Checkbox
2. Circular avatar displaying the sender's first initial on a soft background color
3. Message content area containing:
   - Sender name (bold)
   - Subject line (medium weight)
   - Short preview text (light gray)
4. Right-aligned section containing:
   - Green unread indicator dot (if unread)
   - Timestamp (e.g., 10:24 AM, Yesterday, Apr 22)
   - Category badge (e.g., Applicants, Medical, System)

---

### 6. Visual Indicators

**Unread Messages:**

- Slightly tinted background (very soft green or light gray)
- Green dot on the right side of the row
- Sender name rendered in bold

**Read Messages:**

- White background
- No green dot
- Normal text weight

**Category Badges:**

Each message row must include a small rounded badge. Badge styles are defined as follows:

| Category       | Badge Style         |
|----------------|---------------------|
| Applicants     | Soft green          |
| Medical Team   | Soft blue           |
| System         | Neutral gray        |
| Announcements  | Muted accent color  |

Badges must be subtle and must not visually overpower the message content.

---

### 7. Interaction Behavior

**On message click:**

- The row expands or navigates to a full conversation view.
- The message is automatically marked as read.
- The green unread indicator is removed.

**On row hover:**

- The entire row receives a subtle highlight.
- The cursor changes to a pointer.

---

### 8. Design Standards

The Inbox must adhere to the following design principles:

- Spacious layout with appropriate whitespace
- Minimal visual elements
- Easy to scan at a glance
- Calm, professional aesthetic
- Fully accessible on both desktop and mobile viewports

There must be no visual clutter, no harsh color contrasts, and no dark theme dominance. The primary focus is clarity, organization, and ease of communication between applicants, medical providers, and administrators.

---

## Terminology Standard

### Issue: Inaccurate Use of "Parent" as a System Identifier

Throughout the current system design and interface, the term "Parent" is used as the primary identifier for individuals submitting applications. This terminology is too narrow and does not accurately reflect the full range of users interacting with the system.

Applications may be completed by:

- Parents
- Legal guardians
- Foster caregivers
- Older campers (in applicable cases)

The term "Parent" excludes valid user roles and introduces unnecessary ambiguity in both the interface and the underlying access control model.

### Resolution: Adopt "Applicant" as the Standard System-Wide Identifier

To ensure clarity, inclusivity, and consistency with the system's functional requirements and access control model, the neutral term **"Applicant"** must be adopted as the standard system-wide identifier.

**Implementation requirements:**

- All interface labels currently referencing "Parents" must be updated to "Applicants."
- All inbox filters, dashboard sections, and communication references currently labeled "Parents" must reflect this change.
- Where explanatory context is needed, the phrase "Parent/Guardian" may be used in descriptive text.
- The core system role and all UI labeling must consistently use "Applicant" to maintain professional, inclusive, and scalable terminology.

---

## Application Submission System

### Overview

The Application Submission System for Camp Burnt Gin must be a fully production-ready, enterprise-grade replacement for ReadyOp. It must be designed and implemented from the ground up to meet the following standards:

- Intuitive and easy to understand
- Clean, accessible, and readable interface
- Fully version-controlled
- HIPAA-conscious and secure
- Role-based with strict access control
- Fully auditable
- Architecturally sound and production-ready

---

### System Capabilities

The system must support the following workflows:

1. Admin and Super Admin users upload official application forms.
2. Applicants can:
   - View the entire application without restriction
   - Navigate freely between sections at any time
   - Save progress automatically
   - Upload required and supplemental documents
   - Submit only when the application is fully complete

**Submission Guard Rule:** An application cannot be submitted unless all required sections are complete, all required documents have been uploaded, and all required signatures have been provided.

---

### Application Structure

The system must dynamically render the following sections:

**Section 1 — General Information**

- Applicant information
- Guardian information
- Emergency contact
- Session request
- Interpreter requirement
- Preferred language

**Section 2 — Health and Medical**

- Insurance information
- Diagnoses
- Allergies
- Seizure history
- Immunization status
- Tetanus confirmation

**Section 3 — Development and Behavior**

**Section 4 — Equipment and Mobility**

**Section 5 — Diet and Feeding**

**Section 6 — Personal Care**

**Section 7 — Activities Permissions**

**Section 8 — Medications**

- Dynamic add/remove medication cards

**Section 9 — Required Uploads**

The following documents must be uploaded:

- SC Immunization Certificate
- Medical Examination Form 4523
- Medicaid/Insurance card
- CPAP Waiver (conditional)
- Seizure Action Plan (conditional)
- G-Tube Action Plan (conditional)

**Section 10 — Consents and Digital Signatures**

- General Consent
- Photo Consent
- Release of Liability
- Activity Permission
- Authorization

All signatures must support drawn input and typed input with verification. Each signature must be timestamped and stored securely.

---

### Core UX Requirements

#### Free Navigation

- Users must be able to open any section at any time.
- No forced linear wizard is permitted.
- A sidebar navigation panel must display section status indicators.
- Sections must support expandable accordion behavior.
- A clickable progress map must be available.

Users must be able to read every question, preview every page, view consent forms, and review upload requirements at any point during the application process.

#### Submission Lock Logic

The Submit button must remain disabled until all of the following conditions are satisfied:

- All required fields are completed
- All required uploads are present
- All required checkboxes have been acknowledged
- All required signatures are completed
- Medical examination form is uploaded
- Immunization certificate is uploaded
- All applicable waiver forms are uploaded

The system must display one of two states:

- **Incomplete:** "Missing [N] required items"
- **Complete:** "Application Ready for Submission"

Partial submission is not permitted under any circumstances.

---

### Draft and Auto-Save Behavior

Unlike the legacy ReadyOp system, which did not include a save feature, this system must:

- Auto-save on every field change
- Save automatically every three seconds
- Save on section exit
- Support resume from any device
- Maintain application version integrity throughout the process

---

### Validation System

The system must include the following validation capabilities:

- Real-time field validation
- Visual highlighting of missing required fields
- Field-level error messages
- Scroll-to-error behavior upon submission attempt
- Document upload validation:
  - Accepted formats: PDF, JPG, PNG
  - File size limits enforced
  - Malware scanning placeholder implemented
- Conditional logic:
  - If Seizures = Yes, require Seizure Action Plan upload
  - If G-Tube = Yes, require Feeding Action Plan upload
  - If CPAP = Yes, require CPAP waiver upload

---

### Applicant Dashboard View

The applicant-facing dashboard must display all applications associated with the user's account. Each application must reflect one of the following status indicators:

- Draft
- Incomplete
- Awaiting Documents
- Submitted
- Under Medical Review
- Approved
- Denied
- Waitlisted

Section completion indicators must be displayed as follows:

- Completed
- Incomplete
- Locked (until a condition is met)

---

### Application State Flow

Applications must follow this defined state progression:

```
Draft → Incomplete → Complete → Submitted → Under Review → Approved / Denied / Waitlisted
```

Medical Review must be maintained as a distinct state, separate from Director Review.

---

### Admin Features — Forms Management Module

Administrators must have access to a dedicated Forms Management Module with the following capabilities:

- Upload new application form PDFs (English and Spanish versions)
- Upload medical forms and waiver templates
- Activate a form version for live use
- Archive previous form versions
- Set registration open and close windows
- View application completion analytics
- Download compiled full application packets as PDF

---

### Accessibility Requirements

The system must meet the following accessibility standards:

- WCAG AA compliance
- Full keyboard navigation support
- Screen reader labels on all interactive elements
- Spanish language toggle
- Clear section headings and logical tab order
- Large, readable form typography
- High contrast mode compatibility

---

### Security Requirements

The system must implement the following security measures:

- Role-based access control enforced at every layer
- Encrypted file storage
- Signed URLs for all document access
- Application version locking after submission
- Comprehensive audit logs recording:
  - Who created the application
  - Who edited the application
  - Who submitted the application
  - IP address at time of action
  - Timestamp of all actions
- Multi-factor authentication required for all admin upload actions

---

### Frontend Design Standards

The user interface must adhere to the following design guidelines:

- Clean and professional aesthetic
- Calm, healthcare-grade visual language
- Light theme by default
- Fully readable with no overly dark UI elements
- Section-based layout with sidebar navigation
- Clear and prominent calls to action
- No visual clutter
- Fully mobile responsive

Content must be broken into digestible cards. Walls of unbroken text are not acceptable in any section of the interface.

---

### Technical Requirements

The following technical deliverables must be implemented:

1. Database schema design
2. Backend validation logic
3. File upload handler
4. Dynamic section rendering engine
5. Digital signature storage system
6. Submission validation guard
7. Admin form versioning system
8. Full project documentation updates
9. Complete API endpoint definitions
10. Full folder structure documentation

No placeholders. No partial implementations. No demonstration-only code. All deliverables must be production-ready.

---

### Required Output Deliverables

Upon completion of implementation, the following documentation must be provided:

1. Architecture diagram
2. Database schema
3. API endpoint list
4. Frontend component structure
5. Validation logic breakdown
6. State flow diagram
7. Security considerations
8. Edge case handling documentation
9. Documentation updates
10. Testing plan

---

### Implementation Audit Checklist

Before final delivery, the implementation must be self-audited against the following criteria:

- UX clarity
- Accessibility compliance
- Validation completeness
- Security posture
- Role permission accuracy
- Conditional upload logic
- Multi-language support
- Version control integrity
