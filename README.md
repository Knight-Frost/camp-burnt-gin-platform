# Camp Burnt Gin Application Software

## System Overview

Camp Burnt Gin Application Software is a secure, HIPAA-compliant backend system designed to manage camp registration, medical records, staff workflows, and administrative oversight for the Camp Burnt Gin camp program.

This system replaces an existing third-party platform and serves as the **system of record** for all application data, medical information, and administrative operations.

---

## Project Scope

### Backend (This Repository)

This repository contains the complete **API-only backend** built with Laravel 12. The backend is responsible for:

- **Authentication and Authorization** — User registration, login, multi-factor authentication, role-based access control
- **Application Lifecycle Management** — Camper registration, application submission, draft support, digital signatures, admin review workflows
- **Medical Data Handling** — Protected Health Information (PHI), allergies, medications, medical records, emergency contacts
- **Medical Provider Integration** — Secure, time-limited links for medical providers to submit health information
- **Administrative Workflows** — Application review, reporting, acceptance/rejection letters, mailing and ID label generation
- **Notification System** — Email notifications for application status changes, provider links, and administrative actions
- **Document Management** — Secure file uploads with MIME validation and security scanning

### Frontend (Separate Repository)

Frontend integration is **out of scope** for this repository. The backend exposes a complete RESTful API that will be consumed by a frontend application in a separate development effort.

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | PHP | ^8.2 |
| Framework | Laravel | 12.x |
| Database | MySQL | 8.0+ |
| Authentication | Laravel Sanctum | 4.x |
| MFA | PragmaRX Google2FA | 8.x |
| Password Hashing | bcrypt | — |
| Testing | PHPUnit | 11.x |

---

## Prerequisites

Before setting up the project, ensure the following software is installed:

| Requirement | Minimum Version | Verification Command |
|-------------|-----------------|---------------------|
| PHP | 8.2 | `php -v` |
| Composer | 2.x | `composer -V` |
| MySQL | 8.0 | `mysql --version` |
| Git | 2.x | `git --version` |

### Required PHP Extensions

- `php-mysql` — PDO MySQL driver
- `php-mbstring` — Multibyte string support
- `php-xml` — XML processing
- `php-curl` — HTTP client
- `php-zip` — Archive handling
- `php-gd` or `php-imagick` — Image processing

---

## Installation Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-organization/camp-burnt-gin-api.git
cd camp-burnt-gin-api
```

### Step 2: Install Dependencies

```bash
composer install
```

This command installs all PHP dependencies defined in `composer.json`, including Laravel framework packages, Sanctum, Google2FA, and development tools.

### Step 3: Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure the following required variables:

```dotenv
# Application Settings
APP_NAME="Camp Burnt Gin"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=your_mysql_username
DB_PASSWORD=your_mysql_password

# Mail Configuration (required for notifications)
MAIL_MAILER=smtp
MAIL_HOST=your_mail_host
MAIL_PORT=587
MAIL_USERNAME=your_mail_username
MAIL_PASSWORD=your_mail_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@campburntgin.org
MAIL_FROM_NAME="${APP_NAME}"
```

### Step 4: Generate Application Key

```bash
php artisan key:generate
```

This generates a unique encryption key stored in `APP_KEY` and used for encrypting session data and other sensitive information.

### Step 5: Create the Database

Create the MySQL database before running migrations:

```bash
mysql -u your_username -p -e "CREATE DATABASE camp_burnt_gin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 6: Run Database Migrations

```bash
php artisan migrate
```

This creates all required database tables:

- `users` — User accounts and authentication
- `roles` — Role definitions (admin, parent, medical)
- `camps` — Camp program definitions
- `camp_sessions` — Individual camp session schedules
- `campers` — Camper profiles linked to parent users
- `applications` — Camp applications with status tracking
- `medical_records` — Camper medical information
- `emergency_contacts` — Emergency contact information
- `allergies` — Allergy records with severity levels
- `medications` — Medication records
- `documents` — File upload metadata
- `medical_provider_links` — Secure provider access tokens
- `notifications` — User notification history
- `personal_access_tokens` — Sanctum API tokens

### Step 7: Clear Cached State

```bash
php artisan optimize:clear
```

This clears all cached configuration, routes, and views to ensure a clean state.

### Step 8: Start the Development Server

```bash
php artisan serve
```

The API will be available at `http://localhost:8000`.

---

## Verifying the Installation

### Health Check

Access the API to verify the server is running:

```bash
curl http://localhost:8000/api/camps
```

Expected response: JSON array of camps (empty initially).

### Run Tests

Execute the test suite to verify system integrity:

```bash
php artisan test
```

All tests should pass. If any tests fail, review the error messages and verify database connectivity and environment configuration.

---

## Common Commands

| Command | Description |
|---------|-------------|
| `composer install` | Install PHP dependencies |
| `php artisan key:generate` | Generate application encryption key |
| `php artisan migrate` | Run database migrations |
| `php artisan migrate:fresh` | Drop all tables and re-run migrations |
| `php artisan optimize:clear` | Clear all cached state |
| `php artisan serve` | Start development server |
| `php artisan test` | Run test suite |
| `php artisan test --filter MethodName` | Run specific test |
| `php artisan route:list` | List all registered routes |

---

## Project Structure

```
camp-burnt-gin-api/
├── app/
│   ├── Console/              # Artisan commands
│   ├── Enums/                # Application status, allergy severity enums
│   ├── Http/
│   │   ├── Controllers/Api/  # API controllers (16 controllers)
│   │   ├── Middleware/       # Custom middleware
│   │   └── Requests/         # Form request validation classes
│   ├── Models/               # Eloquent models (12 models)
│   ├── Notifications/        # Email notification classes
│   ├── Policies/             # Authorization policies
│   ├── Providers/            # Service providers
│   └── Services/             # Business logic services
├── bootstrap/                # Framework bootstrap
├── config/                   # Configuration files
├── database/
│   ├── factories/            # Model factories for testing
│   ├── migrations/           # Database schema migrations
│   └── seeders/              # Database seeders
├── routes/
│   └── api.php               # API route definitions
├── storage/                  # File uploads, logs, cache
├── tests/
│   ├── Feature/Api/          # API feature tests
│   ├── Traits/               # Test helper traits
│   └── Unit/                 # Unit tests
├── .env.example              # Environment template
├── composer.json             # PHP dependencies
└── phpunit.xml               # Test configuration
```

---

## Troubleshooting

### Database Connection Failed

**Symptom:** `SQLSTATE[HY000] [2002] Connection refused`

**Solution:**
1. Verify MySQL is running: `sudo systemctl status mysql`
2. Confirm database credentials in `.env`
3. Ensure the database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### Permission Denied on Storage

**Symptom:** `The stream or file could not be opened`

**Solution:**
```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### Migration Failures

**Symptom:** `Base table or table already exists`

**Solution:**
```bash
php artisan migrate:fresh
```

**Warning:** This drops all tables and recreates them. Use only in development.

### Class Not Found Errors

**Symptom:** `Class 'App\...' not found`

**Solution:**
```bash
composer dump-autoload
php artisan optimize:clear
```

---

## Documentation

Comprehensive documentation is available in the following files:

| Document | Description |
|----------|-------------|
| [INSTALLATION_AND_SETUP.md](backend/camp-burnt-gin-api/INSTALLATION_AND_SETUP.md) | Detailed installation and configuration guide |
| [ARCHITECTURE.md](backend/camp-burnt-gin-api/docs/ARCHITECTURE.md) | System architecture and design decisions |
| [SECURITY.md](backend/camp-burnt-gin-api/docs/SECURITY.md) | Security implementation and HIPAA compliance |
| [API_OVERVIEW.md](backend/camp-burnt-gin-api/docs/API_OVERVIEW.md) | API capabilities and endpoint documentation |
| [REQUIREMENTS_AND_TRACEABILITY.md](backend/camp-burnt-gin-api/docs/REQUIREMENTS_AND_TRACEABILITY.md) | Requirements mapping and traceability |
| [BACKEND_COMPLETION_STATUS.md](backend/camp-burnt-gin-api/BACKEND_COMPLETION_STATUS.md) | Backend completion status and handoff notes |
| [CONTRIBUTING.md](backend/camp-burnt-gin-api/CONTRIBUTING.md) | Contribution guidelines |
| [TESTING.md](backend/camp-burnt-gin-api/TESTING.md) | Backend testing documentation |

---

## License

This software is proprietary to Camp Burnt Gin and is not licensed for public use or distribution.

---

## Contact

For technical questions regarding this backend system, contact the development team through the project repository.
