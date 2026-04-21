# Email Notifications

**Project:** Camp Burnt Gin
**Last Updated:** 2026-04-21

---

## Table of Contents

1. [Overview](#1-overview)
2. [Notification Types](#2-notification-types)
3. [Inbox → Email Flow](#3-inbox--email-flow)
4. [Application Status Email Flow](#4-application-status-email-flow)
5. [Duplicate Email Prevention](#5-duplicate-email-prevention)
6. [Notification Preferences](#6-notification-preferences)
7. [Queueing System](#7-queueing-system)
8. [Email Templates and Branding](#8-email-templates-and-branding)
9. [Safety and Privacy Rules](#9-safety-and-privacy-rules)
10. [Recipient Logic](#10-recipient-logic)

---

## 1. Overview

The Camp Burnt Gin backend sends transactional emails through Laravel's notification system backed by Gmail SMTP. All emails are queued asynchronously — no HTTP request waits for SMTP delivery.

The system maintains two parallel dispatch tracks:

- **`SendNotificationJob` track** — the standard path for most notifications. A service class calls `$this->queueNotification($user, $notification)` (from the `QueuesNotifications` trait), which dispatches `SendNotificationJob` to the `notifications` queue. The job calls `$notifiable->notify($notification)` when processed.

- **`ShouldQueue` track** — used exclusively for formal decision letters (`AcceptanceLetterNotification`, `RejectionLetterNotification`). These classes implement `ShouldQueue` directly. They are dispatched via `$user->notify()` from `LetterService` and route themselves to the `notifications` queue via `$this->onQueue('notifications')` set in their constructor.

Both tracks converge on the same `notifications` queue. The queue worker must include this queue name:

```bash
php artisan queue:work --queue=notifications,default
```

---

## 2. Notification Types

### Application Lifecycle

| Notification Class | Trigger | Dispatch Track | Preference Key | Channels |
|---|---|---|---|---|
| `ApplicationSubmittedNotification` | Application finalized (not draft) | `SendNotificationJob` | `application_updates` | mail + database |
| `ApplicationStatusChangedNotification` | Status → under_review, cancelled, withdrawn, re-opened | `SendNotificationJob` | `application_updates` | mail + database |
| `ApplicationStatusChangedNotification::forDatabase()` | Status → approved or rejected (bell only; letter handles email) | `notifyNow()` synchronous | — | database only |
| `AcceptanceLetterNotification` | Application approved | `ShouldQueue` via `$user->notify()` | always sent | mail only |
| `RejectionLetterNotification` | Application rejected | `ShouldQueue` via `$user->notify()` | always sent | mail only |
| `WaitlistedNotification` | Application waitlisted | `SendNotificationJob` | `application_updates` | mail + database |
| `ApplicationRevertedToDraftNotification` | Admin reverts submitted application to draft | `SendNotificationJob` | `application_updates` | mail + database |
| `IncompleteApplicationReminderNotification` | Scheduled: draft incomplete after 7 days | `SendNotificationJob` | `deadlines` | mail + database |

### Messaging (Inbox)

| Notification Class | Trigger | Dispatch Track | Preference Key | Channels |
|---|---|---|---|---|
| `NewMessageNotification` (mail instance) | New message received | `SendNotificationJob` | `messages` | mail only |
| `NewMessageNotification` (database instance) | New message received | `notifyNow()` synchronous | — | database only |
| `NewConversationNotification` | Added to a new conversation | `SendNotificationJob` | `messages` | mail + database |

### Documents

| Notification Class | Trigger | Dispatch Track | Preference Key | Channels |
|---|---|---|---|---|
| `DocumentRequiresCompletionNotification` | Admin requests document from applicant | `SendNotificationJob` | `documents` | mail + database |

### Medical

| Notification Class | Trigger | Preference Key | Channels |
|---|---|---|---|
| `CriticalIncidentLoggedNotification` | Critical medical incident logged | `medical_alerts_email` | database always; mail if preference enabled |
| `MedicalFollowUpDueNotification` | Medical follow-up due/overdue | `medical_alerts_email` | database always; mail if preference enabled |

### Auth

| Notification Class | Trigger | Channels |
|---|---|---|
| `EmailVerificationNotification` | Account registration | mail |
| `PasswordResetNotification` | Password reset requested | mail |
| `PasswordChangedConfirmationNotification` | Password changed | mail |

---

## 3. Inbox → Email Flow

When a message is sent via `MessageService::sendMessage()`, two dispatches happen in the same call:

**1 — Database bell (synchronous):**
```php
$participant->notifyNow(NewMessageNotification::forDatabase($message, $conversation));
```
This writes the in-app notification record immediately, before the HTTP response returns. The `forDatabase()` factory sets `$channelsOverride = ['database']`, so `via()` returns only `['database']` regardless of user preferences.

**2 — Email (queued, preference-gated):**
```php
if ($prefs['messages'] ?? true) {
    dispatch(new SendNotificationJob($participant, NewMessageNotification::forMail($message, $conversation)));
}
```
The `forMail()` factory sets `$channelsOverride = ['mail']`. If the user has disabled `messages` notifications, this dispatch is skipped entirely — no job is created.

**What the email contains:**
- Subject: `New Message — Camp Burnt Gin`
- Recipient's name
- Conversation subject
- Sender's name
- Attachment count (if any)
- CTA button linking to `/{role-prefix}/inbox?conversationId={id}` (role-aware — see URL generation below)
- **Message body is never included** (HIPAA rule)

**URL generation:** `NewMessageNotification::toMail()` and `NewConversationNotification::toMail()` call a private `inboxUrl(object $notifiable, int $conversationId)` helper that resolves the correct portal prefix from the recipient's role (`isSuperAdmin()` → `super-admin`, `isAdmin()` → `admin`, `isMedicalProvider()` → `medical`, default → `applicant`). The resulting URL is `{FRONTEND_URL}/{prefix}/inbox?conversationId={id}`, which lands on an existing route and triggers auto-selection of the conversation in `InboxPage` via the `?conversationId` query param.

---

## 4. Application Status Email Flow

All email dispatch for application status changes is centralised in `ApplicationService::reviewApplication()`.

```
Status transition
    ↓
ApplicationService::reviewApplication()
    ↓
    ├── approved / rejected
    │       ├── notifyNow(ApplicationStatusChangedNotification::forDatabase(...))
    │       │       → writes database bell only, no email
    │       └── LetterService fires AcceptanceLetterNotification / RejectionLetterNotification
    │               → ShouldQueue, onQueue('notifications'), mail only
    │
    ├── waitlisted
    │       └── queueNotification($parentUser, new WaitlistedNotification($application))
    │               → SendNotificationJob → mail + database (preference-gated)
    │
    └── under_review / cancelled / withdrawn / re-opened
            └── queueNotification($parentUser, new ApplicationStatusChangedNotification(...))
                    → SendNotificationJob → mail + database (preference-gated)
```

### Submission email

Triggered in `ApplicationController::store()` (for direct submissions) and `ApplicationController::finalize()` (for draft→submit transitions):

```php
$this->queueNotification($parentUser, new ApplicationSubmittedNotification($application));
```

Draft saves (`is_draft = true`) do not trigger any notification.

### Incomplete application reminder

Dispatched by the scheduled command `applications:send-reminders`:

```bash
php artisan applications:send-reminders --days=7
```

Scheduled Monday 09:00 in `routes/console.php`. Sends `IncompleteApplicationReminderNotification` to parents with draft applications untouched for 7+ days. Gated on the `deadlines` preference key.

---

## 5. Duplicate Email Prevention

When an application is approved or rejected, the system would send two emails if handled naively: one from `ApplicationStatusChangedNotification` (which normally includes a mail channel) and one from the formal decision letter. The system prevents this as follows:

1. `ApplicationService::reviewApplication()` detects `approved` or `rejected` and calls `$parentUser->notifyNow(ApplicationStatusChangedNotification::forDatabase(...))` instead of the standard `queueNotification()`.

2. `ApplicationStatusChangedNotification::forDatabase()` is a static factory that returns an instance with `$channelsOverride = ['database']`. The `via()` method returns `['database']` for this instance, regardless of user preferences. No email is dispatched.

3. Separately, `LetterService` calls `$parentUser->notify(new AcceptanceLetterNotification($application))` or `new RejectionLetterNotification($application)`. These implement `ShouldQueue`, so Laravel's own `SendQueuedNotifications` job handles dispatch. The `onQueue('notifications')` constructor call ensures they land on the correct queue.

Result: one formal letter email per decision, one in-app bell notification. No duplicates.

---

## 6. Notification Preferences

User email preferences are stored in the `notification_preferences` JSON column on the `users` table. All keys default to `true` (email enabled) when absent or null.

| Key | Controls |
|---|---|
| `messages` | Inbox message and new conversation emails |
| `application_updates` | Application status, revert-to-draft, waitlist, incomplete reminder emails |
| `deadlines` | Incomplete application reminder emails (separate from `application_updates`) |
| `documents` | Document request emails |
| `medical_alerts_email` | Medical alert emails (medical staff only) |
| `announcements` | Frontend UI flag only — no backend notification class currently reads this key |
| `in_app_message_notifications` | Frontend UI flag only — controls in-app toast; no backend email reads this key |

Acceptance and rejection letters (`AcceptanceLetterNotification`, `RejectionLetterNotification`) are **not preference-gated**. They always send regardless of user preferences.

Users manage these settings at **Settings → Notifications** in the portal (`/settings`).

---

## 7. Queueing System

### SendNotificationJob

| Property | Value |
|---|---|
| Queue | `notifications` |
| `tries` | 3 |
| `backoff` | `[60, 300, 900]` seconds |
| `maxExceptions` | 3 |
| `after_commit` | `true` (job enters queue only after the surrounding DB transaction commits) |

On failure, the job logs the notifiable type, notifiable ID, notification class, and exception message before failing.

### ShouldQueue notifications (AcceptanceLetter, RejectionLetter)

These are dispatched by Laravel's own queue infrastructure (`SendQueuedNotifications` job). They call `$this->onQueue('notifications')` in their constructor to target the same queue as `SendNotificationJob`.

### Queue worker command

```bash
php artisan queue:work --queue=notifications,default
```

The `notifications` queue must be listed explicitly. Jobs on `default` are also processed to handle Laravel framework jobs.

### Scheduled commands

| Command | Schedule | What it sends |
|---|---|---|
| `applications:send-reminders --days=7` | Mondays at 09:00 | `IncompleteApplicationReminderNotification` |

---

## 8. Email Templates and Branding

All emails use Laravel's `MailMessage` builder (`Illuminate\Notifications\Messages\MailMessage`). The visual frame comes from Laravel's published vendor mail views, customised for Camp Burnt Gin.

### Published view locations

```
resources/views/vendor/mail/html/
├── header.blade.php      — camp name in emerald green, uppercase, linked to app root
├── message.blade.php     — injects camp branding into header slot; camp address in footer
└── themes/
    └── default.css       — all colour and layout overrides
```

These files are committed to source control. The `.gitignore` negation rule `!resources/views/vendor/` ensures the `vendor/` gitignore rule does not block them.

### Visual customisations

| Element | Value |
|---|---|
| Primary button background | `#16a34a` (emerald green) |
| Primary button hover | `#15803d` |
| Link color | `#15803d` |
| Header logo text | `CAMP BURNT GIN` — font-size 20px, font-weight 700, uppercase, letter-spacing 0.06em |
| Header logo color | `#15803d` |
| Panel left border | `#16a34a` |
| Panel background | `#f0fdf4` (green-50) |
| Body background | `#f3f4f6` |
| Card background | `#ffffff` |

### Footer

Every email footer includes:
- Copyright line: `© {year} Camp Burnt Gin · 1628 Old Wire Rd, Gaston, SC 29053`
- Link to notification preferences: `/settings`
- Generic account notice: "You are receiving this email because you have an account with Camp Burnt Gin."

### SMTP configuration

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=your-account@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="your-account@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
FRONTEND_URL=https://your-frontend-domain.com
QUEUE_CONNECTION=database
```

`FRONTEND_URL` is used for all CTA link hrefs. It must point to the React frontend, not the API server.

---

## 9. Safety and Privacy Rules

These rules are enforced in every notification class in the codebase. They are not aspirational — they describe current behaviour.

### No PHI in email bodies

No notification class includes medical record fields, document contents, diagnosis codes, or any other protected health information in `toMail()`. Emails follow the pattern: "you have a notification, log in to see details."

**Current enforcement:**
- `NewMessageNotification` — message body is excluded. Email contains sender name, conversation subject, attachment count. Recipient must log in to read the message.
- `AcceptanceLetterNotification` — includes session name and dates (not PHI). Camper first name is used for personalisation only.
- `RejectionLetterNotification` — optionally includes admin `notes`. Staff must not record PHI in this field; it is for clinical context only.
- Medical notifications — no medical record fields appear in email content.

### No cross-user leakage

Application lifecycle emails are always sent to `$application->camper->user` (the parent account who owns the camper record). No email is sent to arbitrary user IDs.

Messaging emails are sent to the conversation participant's own user account, resolved inside `MessageService`.

### Formal letters bypass preference gates

`AcceptanceLetterNotification` and `RejectionLetterNotification` do not check `notification_preferences`. These are official programme decisions and must be delivered regardless of user settings.

### Database notifications are never suppressed

When a notification targets `['database']` (via `forDatabase()` or preference-gated fallback), the database channel record is always written. In-app bells never depend on email preferences.

---

## 10. Recipient Logic

### Application notifications

| Notification | Recipient |
|---|---|
| `ApplicationSubmittedNotification` | `$application->camper->user` (the parent) |
| `ApplicationStatusChangedNotification` | `$application->camper->user` |
| `AcceptanceLetterNotification` | `$application->camper->user` |
| `RejectionLetterNotification` | `$application->camper->user` |
| `WaitlistedNotification` | `$application->camper->user` |
| `ApplicationRevertedToDraftNotification` | `$application->camper->user` |
| `IncompleteApplicationReminderNotification` | The user whose draft triggered the reminder |

### Messaging notifications

Recipients are resolved from the `conversation_participants` table. Each participant (other than the message sender) receives both a synchronous database notification and — if their `messages` preference is enabled — a queued email notification.

BCC privacy is enforced in `Message::getRecipientsForUser(User $viewer)`: the sender sees TO + CC + BCC; all other participants see TO + CC only. Email notifications do not expose BCC recipients to non-senders.

### Document notifications

`DocumentRequiresCompletionNotification` is sent to the user who owns the document (the applicant), resolved via `$document->uploadedBy`.

### Auth notifications

Password reset and email verification notifications are routed to the email address submitted in the request, not necessarily a database user record (Laravel's built-in behaviour).

---

## Related Documentation

- `docs/backend/EMAIL_NOTIFICATIONS.md` — technical reference (dispatch paths, preference key table, env vars, testing)
- `docs/features/Messaging.md` — full inbox/messaging architecture
- `docs/backend/APPLICATION_LIFECYCLE.md` — application status transition matrix (authoritative)
- `app/Jobs/SendNotificationJob.php` — job class with retry configuration
- `app/Traits/QueuesNotifications.php` — `queueNotification()` helper
- `app/Services/Camper/ApplicationService.php` — notification dispatch inside `reviewApplication()`
- `app/Services/MessageService.php` — notification dispatch inside `sendMessage()`
