# Frontend Product Requirements Document

Product requirements, user stories, and acceptance criteria for the Camp Burnt Gin frontend application.

---

## Product Vision

Build an accessible, user-friendly web application enabling parents to register children with special healthcare needs for Camp Burnt Gin, while providing administrators with efficient tools to review applications and manage camp operations.

---

## User Roles and Goals

| Role | Goals |
|------|-------|
| Parent/Guardian | Register camper, complete application, track status, communicate with staff |
| Administrator | Review applications, manage sessions, communicate with parents |
| Medical Provider | Submit camper medical information via secure link |

---

## Core Features

### 1. Parent Application Flow

**User Story:** As a parent, I want to register my child for camp so they can attend Camp Burnt Gin.

**Acceptance Criteria:**
- Create camper profile with demographics
- Select camp session
- Complete medical information form
- Upload required documents (medical forms, insurance)
- Add emergency contacts
- Digitally sign application
- Submit application for review
- Track application status

**Out of Scope:**
- Payment processing (future phase)
- Multi-year registration in single flow

### 2. Application Dashboard

**User Story:** As a parent, I want to see all my children's applications in one place.

**Acceptance Criteria:**
- List all campers and applications
- Show application status for each
- Display unread message count
- Quick actions: edit draft, view status, message admin
- Filter by camper, status, session

**Out of Scope:**
- Calendar view of sessions
- Printable application summary (future)

### 3. Secure Messaging (INBOX)

**User Story:** As a parent, I want to communicate with camp administrators about my child's application.

**Acceptance Criteria:**
- Send messages to administrators
- Receive messages from administrators
- Thread/reply functionality
- Unread message indicators
- Attach documents to messages
- Search message history

**Out of Scope:**
- Real-time chat (async messaging only)
- Group conversations (1:1 only)

### 4. Document Management

**User Story:** As a parent, I want to upload and manage my child's medical documents.

**Acceptance Criteria:**
- Upload PDF, images, Word docs (max 10 MB)
- Attach to medical records or applications
- View uploaded documents
- Delete own documents
- See document scan status
- Download approved documents

**Out of Scope:**
- Document OCR/data extraction
- Online form completion as alternative to upload

### 5. Admin Application Review

**User Story:** As an administrator, I want to review submitted applications efficiently.

**Acceptance Criteria:**
- View list of pending applications
- Filter by session, status, date
- View complete application details
- Approve, reject, or waitlist applications
- Add review notes
- Send decision notifications automatically

**Out of Scope:**
- Batch approval
- Custom decision workflows

### 6. Medical Provider Portal

**User Story:** As a medical provider, I want to submit a patient's medical information without creating an account.

**Acceptance Criteria:**
- Access via secure link from email
- View camper name (read-only)
- Complete medical questionnaire
- Upload medical documents
- Single-use link (cannot resubmit)
- Clear expiration warning

**Out of Scope:**
- Provider account system
- Historical patient data access

---

## Non-Functional Requirements

### Accessibility (WCAG 2.1 AA)

**Requirements:**
- Keyboard navigation for all functions
- Screen reader compatibility
- Color contrast ratios ≥ 4.5:1
- ARIA labels on interactive elements
- Focus indicators clearly visible
- No time-based auto-logout without warning

**Rationale:** Many camper parents may have disabilities themselves.

### Performance

| Metric | Target |
|--------|--------|
| Initial page load | < 3 seconds |
| Time to interactive | < 5 seconds |
| API response (p95) | < 1 second |
| Lighthouse Performance Score | ≥ 90 |

### Security

- HTTPS only
- XSS protection (Content Security Policy)
- CSRF token validation
- Secure token storage (httpOnly cookies or secure storage)
- Session timeout after 60 minutes of inactivity (HIPAA)
- No PHI in browser console logs

### Browser Support

**Supported:**
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

**Mobile:**
- iOS Safari 15+
- Chrome Android (latest)

**Not Supported:**
- Internet Explorer
- Browsers > 2 versions old

### Responsive Design

| Breakpoint | Min Width | Layout |
|------------|-----------|--------|
| Mobile | 320px | Single column, stacked forms |
| Tablet | 768px | Two-column where appropriate |
| Desktop | 1024px | Full layout with sidebar navigation |
| Large Desktop | 1440px | Max-width container, optimized spacing |

---

## User Flows

### Parent Registration Flow

```
Landing Page → Sign Up
    ↓
Email Verification
    ↓
Complete Profile
    ↓
Dashboard → Add Camper
    ↓
Camper Profile Form
    ↓
Select Camp Session
    ↓
Complete Medical Info
    ↓
Upload Documents
    ↓
Add Emergency Contacts
    ↓
Review & Sign
    ↓
Submit Application
    ↓
Confirmation & Status Tracking
```

### Admin Review Flow

```
Admin Login → Applications List
    ↓
Filter by Status (Under Review)
    ↓
Select Application
    ↓
Review: Camper Info, Medical, Documents, Contacts
    ↓
Make Decision: Approve | Reject | Waitlist
    ↓
Add Review Notes (required for rejection)
    ↓
Submit Decision
    ↓
Automatic Notification Sent to Parent
```

---

## Future Enhancements (Out of Scope)

- Payment integration (Stripe, PayPal)
- Calendar synchronization
- SMS notifications
- Mobile app (native iOS/Android)
- Volunteer management
- Camper check-in system
- Medical incident reporting
- Photo sharing gallery
- Alumni portal

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Application completion rate | > 80% | Submitted / Started |
| Average time to complete | < 30 minutes | Analytics tracking |
| Parent satisfaction (NPS) | > 50 | Post-submission survey |
| Admin review time | < 10 min/application | Time tracking |
| Mobile usage | > 40% | Device analytics |
| Accessibility compliance | 100% WCAG AA | Automated + manual audit |

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
