# Email Notification System

Camp Burnt Gin uses Laravel's notification system with a database queue driver to deliver transactional emails. All emails are sent via Gmail SMTP (configurable to Mailgun in production).

---

## Architecture

### Dispatch Paths

**Standard notifications** (all except formal decision letters) go through `SendNotificationJob`:

```
Service/Controller
  → QueuesNotifications::queueNotification($user, $notification)
    → dispatch(new SendNotificationJob($user, $notification))
      → queue: 'notifications'
        → $user->notify($notification)
```

**Formal decision letters** (`AcceptanceLetterNotification`, `RejectionLetterNotification`) implement `ShouldQueue` and dispatch themselves via `$user->notify()`. They target the `notifications` queue via `$this->onQueue('notifications')` in their constructor.

### Queue Worker

To process email notifications, the queue worker must include the `notifications` queue:

```bash
php artisan queue:work --queue=notifications,default
```

### Retry Configuration (`SendNotificationJob`)

| Property | Value |
|---|---|
| `tries` | 3 |
| `backoff` | 60s, 300s, 900s |
| `maxExceptions` | 3 |
| Queue | `notifications` |

Failures are logged with notifiable type/id, notification class, and exception message.

---

## Notification Inventory

### Inbox / Messaging

| Class | Trigger | Preference Key | Channels |
|---|---|---|---|
| `NewMessageNotification` | New message received in a conversation | `messages` | mail + database (or database-only) |
| `NewConversationNotification` | Added to a new conversation | `messages` | mail + database |

**HIPAA note:** Message body is never included in email. Users are directed to log in to read messages.

### Application Lifecycle

| Class | Trigger | Preference Key | Channels |
|---|---|---|---|
| `ApplicationSubmittedNotification` | Application submitted (not draft) | `application_updates` | mail + database |
| `ApplicationStatusChangedNotification` | Status transitions (under_review, cancelled, withdrawn, re-opened) | `application_updates` | mail + database |
| `ApplicationStatusChangedNotification::forDatabase()` | Status = approved or rejected (database bell only — letters handle email) | — | database only |
| `AcceptanceLetterNotification` | Application approved | always (no preference gate) | mail only |
| `RejectionLetterNotification` | Application rejected | always (no preference gate) | mail only |
| `WaitlistedNotification` | Application waitlisted | `application_updates` | mail + database |
| `ApplicationRevertedToDraftNotification` | Admin reverts submitted application to draft | `application_updates` | mail + database |
| `IncompleteApplicationReminderNotification` | Scheduled reminder for incomplete drafts | `deadlines` | mail + database |

#### No-Duplicate Rule for Approved/Rejected

When an application moves to `approved` or `rejected`, the system sends **one email** — the formal decision letter. `ApplicationStatusChangedNotification` is invoked via `notifyNow()` for the database channel only (in-app bell) to avoid a second email alongside the letter.

### Document Notifications

| Class | Trigger | Preference Key | Channels |
|---|---|---|---|
| `DocumentRequiresCompletionNotification` | Admin requests a document from applicant | `documents` | mail + database |

### Medical Notifications

| Class | Trigger | Preference Key | Channels |
|---|---|---|---|
| `CriticalIncidentLoggedNotification` | Critical medical incident logged | `medical_alerts_email` | database always; mail if preference enabled |
| `MedicalFollowUpDueNotification` | Medical follow-up is due/overdue | `medical_alerts_email` | database always; mail if preference enabled |

### Auth Notifications

| Class | Trigger | Channels |
|---|---|---|
| `EmailVerificationNotification` | Account registration | mail |
| `PasswordResetNotification` | Password reset requested | mail |
| `PasswordChangedConfirmationNotification` | Password changed | mail |

---

## Notification Preferences

User email preferences are stored in the `notification_preferences` JSON column on the `users` table. All keys default to `true` (email enabled) when absent.

| Key | Controls |
|---|---|
| `messages` | Inbox message and new conversation emails |
| `application_updates` | Application status change emails, draft revert alerts |
| `deadlines` | Incomplete application reminder emails |
| `documents` | Document request emails |
| `medical_alerts_email` | Medical alert emails (medical staff) |
| `announcements` | Announcement emails (frontend only — no backend notification class yet) |
| `in_app_message_notifications` | In-app toast only; no email controlled by this key |

Users manage these via **Settings → Notifications** in the portal.

---

## Email Templates

Email templates are published to `resources/views/vendor/mail/html/`. Key customizations:

- **Primary button color**: `#16a34a` (Camp Burnt Gin emerald green) instead of Laravel's default black
- **Header**: Camp Burnt Gin name in emerald green, uppercase
- **Footer**: Camp address (1628 Old Wire Rd, Gaston, SC 29053) and link to notification preferences
- **Background**: `#f3f4f6` (light gray) with white card body
- **Panel accent**: Emerald green left border with light green background

---

## Privacy and HIPAA Compliance

- **No PHI in email bodies.** All emails follow the pattern: "you have a notification, log in to see details."
- Message content, medical data, and document contents are never included in emails.
- The acceptance letter includes session name and dates (not PHI). Camper names are included where contextually appropriate (first name only for personal tone in some cases).
- Rejection letter optionally includes admin `notes` — staff must not record PHI in this field. Notes are clinical context only.
- Cross-user notification leakage is prevented by routing email to the `camper->user` owner, never to arbitrary users.

---

## Scheduled Emails

| Schedule | Command | Notification |
|---|---|---|
| Mondays at 09:00 | `applications:send-reminders --days=7` | `IncompleteApplicationReminderNotification` |

---

## Environment Requirements

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

The `FRONTEND_URL` variable is used for all CTA links in email notifications. It must point to the React frontend, not the API.

---

## Testing

Tests in `tests/Feature/Regression/QueuedNotificationsTest.php` cover:

- Submission queues `ApplicationSubmittedNotification` via `SendNotificationJob`
- Draft submission does not queue notification
- `under_review` transition queues `ApplicationStatusChangedNotification`
- `approved` does NOT queue `ApplicationStatusChangedNotification` email (letter handles it)
- `waitlisted` queues `WaitlistedNotification`, not generic status notification
- Job targets the correct user
- Job uses `notifications` queue
- Job has correct retry configuration (3 tries, exponential backoff)
