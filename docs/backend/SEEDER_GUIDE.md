# Seeder Guide

This guide explains how to control which demo data gets loaded into the Camp Burnt Gin database. It is written for developers, administrators, and anyone setting up a local or staging environment.

---

## What Are Seeders?

Seeders are scripts that populate the database with pre-built data. Instead of manually creating users, applications, and medical records every time you reset the database, seeders do it automatically.

The seeder system is split into two categories:

**System data** — always seeded, in every environment, no exceptions.
- Roles (admin, super_admin, applicant, medical)
- Required document rules
- Activity permissions
- The primary super admin account (`admin@campburntgin.org`)

**Demo data** — only seeded in non-production environments, and only if enabled.
- Staff accounts, applicant families, campers
- Applications across all statuses
- Medical records, medications, treatment logs
- Inbox conversations and messages
- Announcements and calendar events
- Document metadata records
- In-app notifications

---

## How the Seeder Stack Works

The diagram below shows the order in which seeders run and which ones depend on others being completed first.

```
DatabaseSeeder (always runs)
|
+-- RoleSeeder                  [always]
+-- RequiredDocumentRuleSeeder  [always]
+-- ActivityPermissionSeeder    [always]
+-- Super admin account         [always]
|
+-- (production? stop here)
|
+-- (ENABLE_DEMO_DATA=false? stop here)
|
+-- UserSeeder                  [demo]
+-- ApplicantSeeder             [demo]  (needs UserSeeder)
+-- CampSeeder                  [demo]
+-- ApplicationSeeder           [demo]  (needs ApplicantSeeder + CampSeeder)
|
+-- MedicalSeeder               [ENABLE_MEDICAL_SEEDS]
+-- DocumentSeeder              [ENABLE_DOCUMENT_SEEDS]
|
+-- MessageSeeder               [demo]  (needs ApplicationSeeder)
+-- AnnouncementSeeder          [demo]
|
+-- NotificationSeeder          [ENABLE_NOTIFICATION_SEEDS]
```

Seeders lower in the diagram depend on seeders above them. This order is fixed and cannot be changed.

---

## Quick Start

### Step 1 — Open your `.env` file

Your `.env` file is at the root of the backend project:

```
backend/camp-burnt-gin-api/.env
```

If it does not exist, copy the example file:

```bash
cp .env.example .env
```

### Step 2 — Set your flags

Add or edit these lines in `.env`:

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=true
```

All four flags default to `true` if they are not present in `.env`. You only need to add a flag if you want to turn something off.

### Step 3 — Run the seeder

```bash
php artisan migrate:fresh --seed
```

This resets the entire database and re-seeds it from scratch.

---

## The Four Flags

### ENABLE_DEMO_DATA

**Default:** `true`

This is the master switch. Setting it to `false` disables all demo data — including the flags below. Only system data and the super admin account will be seeded.

| Value | Result |
|-------|--------|
| `true` | All demo data is seeded (subject to the flags below) |
| `false` | No demo data at all — roles and super admin only |

Use `false` when you need a completely clean database with no test accounts or sample data.

---

### ENABLE_MEDICAL_SEEDS

**Default:** `true`

Controls whether medical records are seeded. This includes:
- Medical records (physician, insurance)
- Diagnoses
- Allergies
- Medications
- Treatment logs

| Value | Result |
|-------|--------|
| `true` | Medical data seeded for all 8 campers |
| `false` | Campers exist but have no medical records |

Use `false` when testing features that have nothing to do with the medical portal and you want a lighter dataset.

---

### ENABLE_DOCUMENT_SEEDS

**Default:** `true`

Controls whether document metadata records are seeded. No actual files are created on disk — these are database rows that represent uploaded documents (PDFs, clearance letters, insurance cards).

| Value | Result |
|-------|--------|
| `true` | Document records seeded for approved and under-review campers |
| `false` | No document records in the database |

Use `false` when testing features unrelated to document management or verification.

---

### ENABLE_NOTIFICATION_SEEDS

**Default:** `true`

Controls whether in-app (database) notifications are seeded for demo parent accounts. These appear in the Recent Updates panel in the applicant portal.

| Value | Result |
|-------|--------|
| `true` | Read and unread notifications seeded for 3 parent accounts |
| `false` | No notifications in the database |

Use `false` when testing the notification system from scratch so you start with an empty notification inbox.

---

## Common Configurations

### Full demo environment (default)

Everything is seeded. This is the standard local development setup.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=true
```

---

### Roles and super admin only

No demo data at all. Useful for testing the initial setup flow or when you need a blank slate.

```env
ENABLE_DEMO_DATA=false
```

---

### Demo data without medical records

Users, campers, applications, messages, and announcements are seeded. Medical portal will be empty.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=false
ENABLE_DOCUMENT_SEEDS=false
ENABLE_NOTIFICATION_SEEDS=true
```

---

### Demo data without notifications

Useful when developing or testing the notification system — you start with a clean notification inbox.

```env
ENABLE_DEMO_DATA=true
ENABLE_MEDICAL_SEEDS=true
ENABLE_DOCUMENT_SEEDS=true
ENABLE_NOTIFICATION_SEEDS=false
```

---

### Staging environment

Same as "roles and super admin only" — demo data should never be present in staging or production.

```env
APP_ENV=production
ENABLE_DEMO_DATA=false
```

Note: Even if `ENABLE_DEMO_DATA=true`, demo data is never seeded when `APP_ENV=production`. The production guard is built into the seeder itself.

---

## What Gets Seeded (Demo Data Details)

When `ENABLE_DEMO_DATA=true`, the following accounts and records are created.

### Staff Accounts

| Name | Email | Role | Password |
|------|-------|------|----------|
| Super Administrator | admin@campburntgin.org | super_admin | `ChangeThisPassword123!` |
| Deputy Administrator | admin2@campburntgin.org | super_admin | `password` |
| Alex Rivera | admin@example.com | admin | `password` |
| Dr. Morgan Chen | medical@example.com | medical | `password` |

### Applicant Families

| Parent | Email | Campers | Password |
|--------|-------|---------|----------|
| Sarah Johnson | sarah.johnson@example.com | Ethan, Lily | `password` |
| David Martinez | david.martinez@example.com | Sofia | `password` |
| Jennifer Thompson | jennifer.thompson@example.com | Noah | `password` |
| Michael Williams | michael.williams@example.com | Ava, Lucas | `password` |
| Patricia Davis | patricia.davis@example.com | Mia | `password` |
| Grace Wilson | grace.wilson@example.com | Tyler | `password` |

### Applications by Status

| Camper | Session | Status |
|--------|---------|--------|
| Ethan Johnson | Session 1 — Summer 2026 | Approved |
| Lily Johnson | Session 1 — Summer 2026 | Pending |
| Sofia Martinez | Session 1 — Summer 2026 | Under Review |
| Noah Thompson | Session 1 — Summer 2026 | Rejected |
| Noah Thompson | Session 2 — Summer 2026 | Pending |
| Ava Williams | Session 2 — Summer 2026 | Approved |
| Lucas Williams | Session 1 — Summer 2026 | Pending |
| Lucas Williams | Session 2 — Summer 2026 | Cancelled |
| Mia Davis | Session 1 — Summer 2025 | Approved (past session) |
| Tyler Wilson | — | No applications |

---

## Resetting the Database

To wipe the database and re-run all seeders from scratch:

```bash
php artisan migrate:fresh --seed
```

This command:
1. Drops all tables
2. Re-runs all migrations
3. Re-runs all seeders in the correct order

Run this command from inside the backend project directory:

```
backend/camp-burnt-gin-api/
```

---

## Frequently Asked Questions

**Do I need to set all four flags in `.env`?**

No. Any flag you leave out defaults to `true`. You only need to include a flag if you want to change it from the default.

---

**Will demo data be seeded in production?**

No. When `APP_ENV=production`, the seeder skips all demo data regardless of what the flags say. This is a hard guard in the code, not just a config check.

---

**Can I seed only one domain (e.g. only notifications) without running everything?**

Yes, but it requires the base demo data to already be in the database (users, campers, applications). If the database is fresh, run the full seed first, then call a specific seeder:

```bash
php artisan db:seed --class=NotificationSeeder
```

---

**What happens if I run the seeder twice without resetting the database?**

All seeders use `firstOrCreate()` or duplicate checks — running them twice will not create duplicate records. It is safe to run the seeder on a database that already has data.

---

**I want a fresh database but without wiping migrations — is that possible?**

No. `migrate:fresh` always drops and re-runs migrations. If you only want to re-seed without touching migrations, use:

```bash
php artisan db:seed
```

This runs the seeder on whatever the current database state is.

---

## Related Documentation

- [SETUP.md](SETUP.md) — full environment setup instructions
- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) — role definitions and permission matrix
- [DATA_MODEL.md](DATA_MODEL.md) — database tables and relationships

---

**Document Status:** Complete
**Last Updated:** Phase 11 — Seeder System
