# Installation and Setup Guide

This document provides comprehensive installation and configuration instructions for the Camp Burnt Gin API backend system. It is intended for developers, system administrators, and technical team members responsible for deploying and maintaining the application.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Dependency Overview](#dependency-overview)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [Application Configuration](#application-configuration)
6. [Mail Configuration](#mail-configuration)
7. [Directory Structure](#directory-structure)
8. [Verification Procedures](#verification-procedures)
9. [Development Environment](#development-environment)
10. [Production Considerations](#production-considerations)

---

## System Requirements

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk Space | 5 GB | 20 GB |

### Software Requirements

| Software | Minimum Version | Purpose |
|----------|-----------------|---------|
| PHP | 8.2.0 | Runtime environment |
| Composer | 2.0.0 | Dependency management |
| MySQL | 8.0.0 | Database server |
| Git | 2.0.0 | Version control |

### Required PHP Extensions

The following PHP extensions must be installed and enabled:

| Extension | Purpose |
|-----------|---------|
| `pdo_mysql` | MySQL database driver for PHP Data Objects |
| `mbstring` | Multibyte string operations for Unicode support |
| `xml` | XML parsing for package management |
| `curl` | HTTP client for external API calls |
| `zip` | Archive handling for package installation |
| `gd` or `imagick` | Image processing for document handling |
| `openssl` | Cryptographic operations and HTTPS |
| `tokenizer` | PHP code tokenization for development tools |
| `ctype` | Character type checking |
| `json` | JSON encoding and decoding |
| `fileinfo` | MIME type detection for uploads |

To verify PHP extensions:

```bash
php -m | grep -E "(pdo_mysql|mbstring|xml|curl|zip|gd|openssl)"
```

---

## Dependency Overview

### Production Dependencies

These packages are required for the application to function:

| Package | Version | Purpose |
|---------|---------|---------|
| `laravel/framework` | ^12.0 | Core application framework |
| `laravel/sanctum` | ^4.0 | API token authentication |
| `pragmarx/google2fa-laravel` | ^2.2 | TOTP-based multi-factor authentication |
| `bacon/bacon-qr-code` | ^3.0 | QR code generation for MFA setup |

### Development Dependencies

These packages are used during development and testing only:

| Package | Version | Purpose |
|---------|---------|---------|
| `phpunit/phpunit` | ^11.0 | Unit and feature testing |
| `fakerphp/faker` | ^1.23 | Test data generation |
| `mockery/mockery` | ^1.6 | Test mocking framework |
| `laravel/sail` | ^1.26 | Docker development environment (optional) |

### Installing Dependencies

After cloning the repository, install all dependencies:

```bash
composer install
```

For production environments, install without development dependencies:

```bash
composer install --no-dev --optimize-autoloader
```

---

## Environment Setup

### Creating the Environment File

The application requires a `.env` file containing environment-specific configuration. Create this file from the provided template:

```bash
cp .env.example .env
```

### Generating the Application Key

The application key is used for encryption of session data, signed URLs, and other security-sensitive operations. Generate a unique key:

```bash
php artisan key:generate
```

This command generates a 32-character random key and stores it in the `APP_KEY` environment variable.

**Security Notice:** The application key must be kept confidential and should never be committed to version control. In production, generate a unique key and store it securely.

### Environment Variables Reference

#### Application Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_NAME` | Application display name | `"Camp Burnt Gin"` |
| `APP_ENV` | Environment mode | `local`, `staging`, `production` |
| `APP_DEBUG` | Enable debug mode | `true` (dev), `false` (prod) |
| `APP_KEY` | Encryption key | Auto-generated |
| `APP_URL` | Base application URL | `http://localhost:8000` |

#### Database Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_CONNECTION` | Database driver | `mysql` |
| `DB_HOST` | Database server address | `127.0.0.1` |
| `DB_PORT` | Database server port | `3306` |
| `DB_DATABASE` | Database name | `camp_burnt_gin` |
| `DB_USERNAME` | Database username | `camp_user` |
| `DB_PASSWORD` | Database password | `secure_password` |

#### Mail Settings

| Variable | Description | Example |
|----------|-------------|---------|
| `MAIL_MAILER` | Mail transport driver | `smtp` |
| `MAIL_HOST` | SMTP server address | `smtp.mailgun.org` |
| `MAIL_PORT` | SMTP server port | `587` |
| `MAIL_USERNAME` | SMTP username | `postmaster@domain` |
| `MAIL_PASSWORD` | SMTP password | `mail_password` |
| `MAIL_ENCRYPTION` | Transport encryption | `tls` |
| `MAIL_FROM_ADDRESS` | Default sender address | `noreply@campburntgin.org` |
| `MAIL_FROM_NAME` | Default sender name | `"Camp Burnt Gin"` |

---

## Database Configuration

### Creating the Database

Connect to MySQL and create the database:

```bash
mysql -u root -p
```

Execute the following SQL:

```sql
CREATE DATABASE camp_burnt_gin
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER 'camp_user'@'localhost' IDENTIFIED BY 'your_secure_password';

GRANT ALL PRIVILEGES ON camp_burnt_gin.* TO 'camp_user'@'localhost';

FLUSH PRIVILEGES;

EXIT;
```

### Database Character Set

The database uses `utf8mb4` character set with `utf8mb4_unicode_ci` collation to support:

- Full Unicode character set including emoji
- Proper sorting and comparison of international characters
- 4-byte UTF-8 encoding

### Running Migrations

Migrations define the database schema. Execute all migrations:

```bash
php artisan migrate
```

To view migration status:

```bash
php artisan migrate:status
```

### Database Tables

The following tables are created by migrations:

| Table | Description |
|-------|-------------|
| `users` | User accounts with authentication credentials |
| `password_reset_tokens` | Temporary tokens for password recovery |
| `sessions` | Session storage for authenticated users |
| `roles` | Role definitions (admin, parent, medical) |
| `camps` | Camp program configurations |
| `camp_sessions` | Camp session schedules and capacity |
| `campers` | Camper profile information |
| `applications` | Camp applications with status tracking |
| `medical_records` | Camper medical information |
| `emergency_contacts` | Emergency contact details |
| `allergies` | Allergy records with severity |
| `medications` | Medication records |
| `documents` | Uploaded file metadata |
| `medical_provider_links` | Secure provider access tokens |
| `notifications` | User notification history |
| `personal_access_tokens` | Sanctum API authentication tokens |

---

## Application Configuration

### Configuration Files

Key configuration files located in the `config/` directory:

| File | Purpose |
|------|---------|
| `app.php` | Application settings (name, timezone, locale) |
| `auth.php` | Authentication guards and providers |
| `database.php` | Database connection settings |
| `mail.php` | Mail transport configuration |
| `sanctum.php` | API token authentication settings |
| `filesystems.php` | File storage disk configuration |

### Sanctum Configuration

API authentication is handled by Laravel Sanctum. The `config/sanctum.php` file contains:

- Token expiration settings
- Stateful domain configuration
- Guard customization

### File Storage Configuration

Document uploads are stored using Laravel's filesystem abstraction. Configure the `local` disk in `config/filesystems.php`:

```php
'disks' => [
    'local' => [
        'driver' => 'local',
        'root' => storage_path('app'),
    ],
    'documents' => [
        'driver' => 'local',
        'root' => storage_path('app/documents'),
        'visibility' => 'private',
    ],
],
```

Ensure the storage directory is writable:

```bash
chmod -R 775 storage
```

---

## Mail Configuration

### SMTP Configuration

The application sends notifications via SMTP. Configure these settings in `.env`:

```dotenv
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@campburntgin.org
MAIL_FROM_NAME="Camp Burnt Gin"
```

### Testing Mail Configuration

Verify mail configuration using Artisan:

```bash
php artisan tinker
```

Then in the Tinker console:

```php
Mail::raw('Test email', function ($message) {
    $message->to('test@example.com')->subject('Test');
});
```

### Notification Types

The system sends the following notifications:

| Notification | Trigger | Recipient |
|--------------|---------|-----------|
| Application Submitted | Application submission | Parent |
| Status Changed | Admin reviews application | Parent |
| Provider Link Created | Link generated | Medical provider |
| Provider Link Revoked | Link revoked | Parent |
| Provider Submission Received | Provider submits data | Parent, Admin |
| Acceptance Letter | Application approved | Parent |
| Rejection Letter | Application rejected | Parent |
| Password Reset | Reset requested | User |

---

## Directory Structure

### Application Directories

```
app/
├── Console/                 # Artisan commands
│   └── Commands/           # Custom command classes
├── Enums/                  # PHP enumerations
│   ├── ApplicationStatus.php
│   └── AllergySeverity.php
├── Http/
│   ├── Controllers/
│   │   └── Api/           # 16 API controllers
│   ├── Middleware/        # Custom middleware
│   │   ├── EnsureUserIsAdmin.php
│   │   └── EnsureUserHasRole.php
│   └── Requests/          # Form request classes
│       ├── Auth/
│       ├── Camper/
│       ├── Application/
│       └── ...
├── Models/                 # 12 Eloquent models
├── Notifications/          # 9 notification classes
├── Policies/              # 8 authorization policies
├── Providers/             # Service providers
└── Services/              # 7 business logic services
```

### Storage Directories

```
storage/
├── app/
│   ├── documents/         # Uploaded documents (private)
│   └── public/           # Public file storage
├── framework/
│   ├── cache/            # Application cache
│   ├── sessions/         # Session files
│   └── views/            # Compiled views
└── logs/
    └── laravel.log       # Application log file
```

### Creating Required Directories

Ensure storage directories exist and are writable:

```bash
mkdir -p storage/app/documents
mkdir -p storage/framework/{cache,sessions,views}
mkdir -p storage/logs
chmod -R 775 storage bootstrap/cache
```

---

## Verification Procedures

### Step 1: Verify PHP Configuration

```bash
php -v
# Expected: PHP 8.2.x or higher

php -m | grep -E "(pdo_mysql|mbstring|xml|curl)"
# Expected: All extensions listed
```

### Step 2: Verify Composer Installation

```bash
composer -V
# Expected: Composer version 2.x.x

composer check-platform-reqs
# Expected: All requirements satisfied
```

### Step 3: Verify Database Connection

```bash
php artisan tinker
```

In Tinker:

```php
DB::connection()->getPdo();
# Expected: PDO object returned without errors
exit
```

### Step 4: Verify Application Key

```bash
grep APP_KEY .env
# Expected: APP_KEY=base64:... (32-character encoded key)
```

### Step 5: Verify Routes

```bash
php artisan route:list --path=api
# Expected: All API routes listed
```

### Step 6: Run Test Suite

```bash
php artisan test
# Expected: All tests pass
```

### Step 7: Verify API Response

Start the development server:

```bash
php artisan serve
```

In another terminal:

```bash
curl -X GET http://localhost:8000/api/camps \
    -H "Accept: application/json"
# Expected: JSON array response (may be empty)
```

---

## Development Environment

### Starting the Development Server

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

### Watching for Changes

Clear caches during development to reflect changes immediately:

```bash
php artisan optimize:clear
```

### Running Specific Tests

Run a single test file:

```bash
php artisan test tests/Feature/Api/ApplicationAuthorizationTest.php
```

Run tests matching a pattern:

```bash
php artisan test --filter test_admin_can_view_all_applications
```

### Database Seeding (Development Only)

For development, seed the database with test data:

```bash
php artisan db:seed
```

**Warning:** Never run seeders in production.

---

## Production Considerations

### Environment Configuration

For production deployments:

```dotenv
APP_ENV=production
APP_DEBUG=false
```

### Caching Configuration

Optimize performance by caching configuration:

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### File Permissions

Set restrictive permissions in production:

```bash
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
chmod -R 775 storage bootstrap/cache
```

### Log Rotation

Configure log rotation to prevent disk space exhaustion. Add to `/etc/logrotate.d/laravel`:

```
/path/to/app/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
}
```

### Queue Worker (If Using Queued Jobs)

For asynchronous processing, start a queue worker:

```bash
php artisan queue:work --sleep=3 --tries=3
```

In production, use a process manager like Supervisor to manage queue workers.

### HTTPS Configuration

The API should be served over HTTPS in production. Configure your web server (Nginx, Apache) with SSL certificates and ensure `APP_URL` uses `https://`.

---

## Onboarding Checklist

For new team members setting up the development environment:

- [ ] Install PHP 8.2+ with required extensions
- [ ] Install Composer 2.x
- [ ] Install MySQL 8.0+
- [ ] Clone the repository
- [ ] Run `composer install`
- [ ] Copy `.env.example` to `.env`
- [ ] Configure database credentials in `.env`
- [ ] Configure mail settings in `.env`
- [ ] Run `php artisan key:generate`
- [ ] Create the database
- [ ] Run `php artisan migrate`
- [ ] Run `php artisan optimize:clear`
- [ ] Run `php artisan test` to verify setup
- [ ] Start `php artisan serve` and test API access

Upon completing these steps, the development environment is ready for use.
