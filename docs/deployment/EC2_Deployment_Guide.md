# EC2 Deployment Guide — Camp Burnt Gin

This guide covers the complete, end-to-end deployment of the Camp Burnt Gin application on an AWS EC2 instance running Amazon Linux 2023. It was written and validated against the live deployment at the time of authorship.

Following this guide from start to finish produces a fully working system with the React frontend and Laravel API running on a single t2.micro instance.

---

## Prerequisites

### Tools required on your local machine

- A terminal application (macOS Terminal, iTerm2, or any Linux shell)
- Git (to clone the repository)
- Node.js 20 and npm 10 (to build the frontend locally — the EC2 instance cannot build it)
- SSH client (included on macOS and Linux by default)
- rsync (included on macOS and Linux by default)

### Access required

- An AWS account with permission to create EC2 instances and modify security groups
- Read access to the GitHub repository: `WinthropUniversity/project-2025-2026-pizza-tacos`
- The EC2 key pair file (`.pem`) stored in a known location on your machine

### Important constraints

This guide is written for a t2.micro instance. That instance has 1 vCPU and 1 GB of RAM. The React frontend build process requires more memory than the instance provides. For this reason, the frontend is built on your local machine and transferred to the server. Do not attempt to run `npm run build` directly on the EC2 instance.

---

## Part 1 — Create the EC2 Instance

### 1.1 Launch a new instance

1. Sign in to the AWS Management Console.
2. Navigate to EC2 and click Launch Instance.
3. Set the instance name to `camp-burnt-gin`.
4. Under Application and OS Images, select Amazon Linux 2023 AMI (the default x86_64 version).
5. Under Instance type, select `t2.micro` (eligible for the free tier).

### 1.2 Create and save a key pair

1. Under Key pair (login), click Create new key pair.
2. Name the key pair `cbg-key`.
3. Select RSA as the key type and `.pem` as the file format.
4. Click Create key pair. The file `cbg-key.pem` downloads automatically.
5. Move the file to your home directory's Downloads folder or another permanent location.

   ```
   mv ~/Downloads/cbg-key.pem ~/Downloads/cbg-key.pem
   ```

   Do not rename or move this file after you record its location.

### 1.3 Configure the security group

Under Network settings, click Edit and apply the following inbound rules:

- Rule 1: Type SSH, Port 22, Source 0.0.0.0/0
- Rule 2: Type HTTP, Port 80, Source 0.0.0.0/0

No other ports are required. Do not open port 8000, 3306, or any other port.

### 1.4 Launch the instance

Click Launch Instance. Wait for the instance state to show Running and the status checks to show 2/2 checks passed before proceeding.

Record the Public IPv4 address shown in the instance details panel. This guide uses `YOUR_EC2_IP` as a placeholder for that address.

---

## Part 2 — Connect to the Server

### 2.1 Set key file permissions

SSH requires that the key file is readable only by its owner. Run this command once:

```bash
chmod 400 ~/Downloads/cbg-key.pem
```

### 2.2 Connect via SSH

```bash
ssh -i ~/Downloads/cbg-key.pem ec2-user@YOUR_EC2_IP
```

When prompted to confirm the host fingerprint, type `yes` and press Enter. You will see a prompt beginning with `[ec2-user@ip-...]` when the connection succeeds.

---

## Part 3 — Prepare the Server

All commands in this section run on the EC2 instance unless stated otherwise.

### 3.1 Add a swap file

The t2.micro instance does not have enough RAM to run all services under load without swap. Create a 2 GB swap file before installing anything:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verify swap is active:

```bash
free -h
```

The Swap row should show approximately 2.0 GB total.

### 3.2 Install Git

```bash
sudo dnf install -y git
```

### 3.3 Install PHP 8.2 and required extensions

```bash
sudo dnf install -y \
  php8.2 \
  php8.2-fpm \
  php8.2-mysqlnd \
  php8.2-xml \
  php8.2-mbstring \
  php8.2-zip \
  php8.2-bcmath \
  php8.2-intl \
  php8.2-gd \
  php8.2-opcache
```

Verify the installation:

```bash
php --version
```

The output must show PHP 8.2.x or later.

### 3.4 Install Composer

```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

Verify:

```bash
composer --version
```

### 3.5 Install Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

Verify:

```bash
node --version
npm --version
```

Node must be v20.x or later.

### 3.6 Install Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3.7 Install MySQL 8.0

Amazon Linux 2023 does not include MySQL in its default repositories. Add the MySQL Community repository and install:

```bash
sudo dnf install -y https://dev.mysql.com/get/mysql80-community-release-el9-1.noarch.rpm --nogpgcheck
sudo dnf install -y mysql-community-server --nogpgcheck
sudo systemctl enable mysqld
sudo systemctl start mysqld
```

Verify the service is running:

```bash
sudo systemctl status mysqld | grep Active
```

### 3.8 Configure PHP-FPM to run as the nginx user

Open the PHP-FPM pool configuration:

```bash
sudo sed -i 's/^user = apache/user = nginx/' /etc/php-fpm.d/www.conf
sudo sed -i 's/^group = apache/group = nginx/' /etc/php-fpm.d/www.conf
```

Enable and start PHP-FPM:

```bash
sudo systemctl enable php-fpm
sudo systemctl start php-fpm
```

Verify the socket file exists:

```bash
ls /run/php-fpm/www.sock
```

---

## Part 4 — Set Up the Database

### 4.1 Secure MySQL and create the application database

MySQL 8 on Amazon Linux 2023 starts with no root password when installed from the community repository. Connect and configure it:

```bash
sudo mysql
```

Inside the MySQL prompt, run the following statements. Replace `YOUR_DB_PASSWORD` with a strong password of your choice and record it:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
CREATE DATABASE camp_burnt_gin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
FLUSH PRIVILEGES;
EXIT;
```

Verify the database was created:

```bash
mysql -u root -p'YOUR_DB_PASSWORD' -e "SHOW DATABASES;" | grep camp_burnt_gin
```

---

## Part 5 — Deploy the Application

### 5.1 Create the project directory

```bash
sudo mkdir -p /var/www/camp-burnt-gin
sudo chown ec2-user:ec2-user /var/www/camp-burnt-gin
```

### 5.2 Clone the repository

```bash
git clone https://github.com/WinthropUniversity/project-2025-2026-pizza-tacos.git /var/www/camp-burnt-gin
```

If the repository is private and you do not have SSH keys configured on the server, use HTTPS with your GitHub credentials. If the clone fails due to access restrictions, see the note at the end of this section.

After cloning, confirm the structure:

```bash
ls /var/www/camp-burnt-gin/
```

You must see `backend/` and `frontend/` directories.

Confirm the Laravel root:

```bash
ls /var/www/camp-burnt-gin/backend/artisan
```

If this file exists, the backend is at `/var/www/camp-burnt-gin/backend/`. All backend commands use this path.

Note: If the repository is private and direct clone fails, an alternative is to clone locally and transfer via rsync. See Part 6 for the frontend rsync pattern, which applies equally to the full project directory.

---

## Part 6 — Configure the Laravel Backend

All commands in this section run on the EC2 instance inside `/var/www/camp-burnt-gin/backend/`.

### 6.1 Install PHP dependencies

```bash
cd /var/www/camp-burnt-gin/backend
composer install --no-dev --optimize-autoloader
```

This installs all backend dependencies. The `--no-dev` flag excludes development-only packages. This step takes approximately 60 to 90 seconds.

### 6.2 Create the environment file

```bash
cp .env.example .env
```

### 6.3 Generate the application key

```bash
php artisan key:generate
```

### 6.4 Configure the environment file

Open `.env` with a text editor. The following is the minimal required configuration for a working HTTP deployment. Replace the placeholder values with your actual values:

```bash
nano .env
```

Set or update the following variables. Leave all other variables at their default values from `.env.example`:

```
APP_NAME="Camp Burnt Gin API"
APP_ENV=production
APP_DEBUG=false
APP_URL=http://YOUR_EC2_IP

FRONTEND_URL=http://YOUR_EC2_IP

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=camp_burnt_gin
DB_USERNAME=root
DB_PASSWORD=YOUR_DB_PASSWORD

SANCTUM_STATEFUL_DOMAINS=YOUR_EC2_IP

SESSION_DRIVER=database
SESSION_LIFETIME=30
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax

CORS_ALLOWED_ORIGINS=http://YOUR_EC2_IP

LOG_CHANNEL=stack
LOG_LEVEL=info

BROADCAST_CONNECTION=log
QUEUE_CONNECTION=database
CACHE_STORE=database
```

Critical values explained:

- `APP_DEBUG=false` — must be false in any non-development environment. Setting this to true exposes stack traces and internal paths to anyone who triggers an error.
- `SESSION_SECURE_COOKIE=false` — must be false when serving over HTTP. A value of true causes the browser to refuse the session cookie on non-HTTPS connections.
- `CORS_ALLOWED_ORIGINS=http://YOUR_EC2_IP` — must exactly match the origin the browser uses. If this is wrong, all API calls will be blocked by the browser with a network error.
- `SANCTUM_STATEFUL_DOMAINS=YOUR_EC2_IP` — tells Sanctum which domains may use cookie-based authentication.

Save and close the file.

### 6.5 Set file permissions

The web server process must be able to write to the storage and cache directories:

```bash
sudo chown -R ec2-user:nginx /var/www/camp-burnt-gin/backend/storage
sudo chown -R ec2-user:nginx /var/www/camp-burnt-gin/backend/bootstrap/cache
sudo chmod -R 775 /var/www/camp-burnt-gin/backend/storage
sudo chmod -R 775 /var/www/camp-burnt-gin/backend/bootstrap/cache
```

### 6.6 Run database migrations

```bash
php artisan migrate --force
```

The `--force` flag is required in production mode to confirm that migrations will run against a non-development database. This command creates all application tables.

If a migration fails with a message about a column not existing, the migration contains a data-fix operation that references a schema version ahead of or behind the current state. In that case, run:

```bash
php artisan migrate --force 2>&1
```

Record the exact error and migration name. You can mark a specific migration as already run without executing it:

```bash
php artisan migrate:status
php artisan db:seed --class=DatabaseSeeder
```

### 6.7 Seed the database

```bash
php artisan db:seed
```

This creates the required roles, test sessions, and a default super administrator account. The seeded credentials are logged to the terminal output. Record the email and password.

### 6.8 Cache the configuration

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

These commands improve performance by compiling configuration, routes, and views into cached files. You must re-run these commands after any change to `.env` or configuration files.

### 6.9 Verify the API is reachable locally

```bash
curl -s http://localhost/api/health
```

If Nginx is not yet configured, test via the artisan development server temporarily:

```bash
php artisan serve --host=127.0.0.1 --port=8000 &
curl -s http://127.0.0.1:8000/api/health
kill %1
```

The response must be a JSON object with a status field. Any 200 response confirms the backend is working.

---

## Part 7 — Build and Deploy the Frontend

The React frontend must be built on your local machine. The t2.micro instance cannot complete the build process due to insufficient memory.

All commands in this section run on your local machine unless stated otherwise.

### 7.1 Navigate to the frontend directory

```bash
cd /path/to/Camp_Burnt_Gin_Project/frontend
```

Replace `/path/to/Camp_Burnt_Gin_Project` with the actual path where you cloned the repository locally.

### 7.2 Install dependencies

If you have not already installed dependencies locally:

```bash
npm install
```

### 7.3 Create a local production environment override

Create a file named `.env.production.local` inside the `frontend/` directory. This file is git-ignored and will not be committed:

```bash
cat > .env.production.local << 'EOF'
VITE_API_BASE_URL=http://YOUR_EC2_IP
VITE_ALLOW_HTTP=true
EOF
```

Replace `YOUR_EC2_IP` with the actual public IP address of your EC2 instance.

The `VITE_ALLOW_HTTP=true` flag explicitly permits an HTTP backend URL. The application's default security configuration rejects HTTP origins to protect PHI in transit. This flag is only appropriate for controlled educational or development deployments where HTTPS is not yet configured.

### 7.4 Build the production assets

```bash
npm run build
```

This command performs TypeScript type checking and compiles the application into the `dist/` directory. The build takes approximately 5 to 10 seconds on a modern local machine.

Verify the build completed successfully:

```bash
ls dist/
```

You must see `index.html`, an `assets/` directory, and optionally `backgrounds/`, `fonts/`, and `images/` directories.

### 7.5 Transfer the build to the EC2 instance

```bash
rsync -az --delete \
  -e "ssh -i ~/Downloads/cbg-key.pem -o StrictHostKeyChecking=no" \
  dist/ \
  ec2-user@YOUR_EC2_IP:/var/www/camp-burnt-gin/frontend/dist/
```

Verify the transfer:

```bash
ssh -i ~/Downloads/cbg-key.pem ec2-user@YOUR_EC2_IP \
  "ls /var/www/camp-burnt-gin/frontend/dist/"
```

You must see `index.html` and `assets/` in the output.

---

## Part 8 — Configure Nginx

All commands in this section run on the EC2 instance.

### 8.1 Disable the default server block

The default Nginx configuration on Amazon Linux 2023 listens on port 80 and conflicts with the application configuration. Disable it:

```bash
sudo sed -i 's/listen 80 default_server;/listen 8080 default_server;/' /etc/nginx/nginx.conf
sudo sed -i 's/listen \[::\]:80 default_server;/listen [::]:8080 default_server;/' /etc/nginx/nginx.conf
```

### 8.2 Create the application server block

```bash
sudo tee /etc/nginx/conf.d/camp-burnt-gin.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name YOUR_EC2_IP _;

    # Maximum upload size for medical documents and forms
    client_max_body_size 20M;

    # Laravel API and Sanctum CSRF endpoint
    location ~ ^/(api|sanctum) {
        root /var/www/camp-burnt-gin/backend/public;
        fastcgi_pass unix:/run/php-fpm/www.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/camp-burnt-gin/backend/public/index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_read_timeout 60;
        include fastcgi_params;
    }

    # Laravel public storage (user-uploaded files served directly)
    location /storage {
        alias /var/www/camp-burnt-gin/backend/storage/app/public;
        try_files $uri =404;
    }

    # React single-page application
    root /var/www/camp-burnt-gin/frontend/dist;
    index index.html;

    # Static assets with long-term cache headers
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # All other routes return the SPA entry point for client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

Replace `YOUR_EC2_IP` in the `server_name` directive with the actual IP address.

### 8.3 Test and reload Nginx

```bash
sudo nginx -t
```

The output must include `syntax is ok` and `test is successful`. If it does not, review the configuration file for typos before proceeding.

```bash
sudo systemctl reload nginx
```

---

## Part 9 — Final Verification

All commands in this section can run either on the EC2 instance or from your local machine.

### 9.1 Confirm all services are running

On the EC2 instance:

```bash
sudo systemctl status mysqld | grep Active
sudo systemctl status php-fpm | grep Active
sudo systemctl status nginx | grep Active
```

All three must show `active (running)`.

### 9.2 Test the API endpoints

```bash
curl -s -o /dev/null -w "%{http_code}" http://YOUR_EC2_IP/api/health
```

The response code must be 200.

```bash
curl -s -X POST http://YOUR_EC2_IP/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"admin@campburntgin.org","password":"YOUR_SEEDED_PASSWORD"}'
```

A successful login returns a JSON object with `"success": true` and a `token` field. If the credentials are wrong, the response is `"Invalid credentials."` with HTTP 401.

### 9.3 Test the frontend

Open a browser and navigate to `http://YOUR_EC2_IP`. The login page must render with form fields visible. If the page is blank or black, see the troubleshooting section.

### 9.4 Test a full login

Enter the seeded admin credentials on the login page. A successful login redirects to the admin dashboard. If login fails with "Network error", see the troubleshooting section.

---

## Part 10 — Troubleshooting

### Blank or black screen in the browser

The React application loaded its HTML but the JavaScript crashed before rendering.

**Cause 1: Missing API URL in the build.**

The application throws a JavaScript error at startup if `VITE_API_BASE_URL` was not set during the build and the bundle was built in production mode. Check whether the environment override file exists:

```bash
cat frontend/.env.production.local
```

If it does not exist, or if `VITE_API_BASE_URL` is missing from it, create it and rebuild:

```bash
cat > frontend/.env.production.local << 'EOF'
VITE_API_BASE_URL=http://YOUR_EC2_IP
VITE_ALLOW_HTTP=true
EOF
npm run build
rsync -az --delete -e "ssh -i ~/Downloads/cbg-key.pem" \
  frontend/dist/ ec2-user@YOUR_EC2_IP:/var/www/camp-burnt-gin/frontend/dist/
```

**Cause 2: Stale cached assets in the browser.**

Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS) to perform a hard reload.

**Cause 3: Nginx is pointing to the wrong directory.**

On the EC2 instance, verify the dist directory has content:

```bash
ls /var/www/camp-burnt-gin/frontend/dist/
```

If `index.html` is missing, the rsync transfer did not complete. Re-run the rsync command.

### Login fails with "Network error"

The browser attempted to contact the API but received no response.

**Cause 1: CORS origin not in the allowed list.**

On the EC2 instance, check the backend `.env`:

```bash
grep CORS_ALLOWED_ORIGINS /var/www/camp-burnt-gin/backend/.env
```

The value must be `http://YOUR_EC2_IP` exactly. If it is missing or uses localhost, update it and clear the config cache:

```bash
sed -i 's|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=http://YOUR_EC2_IP|' \
  /var/www/camp-burnt-gin/backend/.env
cd /var/www/camp-burnt-gin/backend && php artisan config:clear && php artisan config:cache
```

Test the CORS preflight response:

```bash
curl -s -I -X OPTIONS http://localhost/api/auth/login \
  -H "Origin: http://YOUR_EC2_IP" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control
```

The response must include `Access-Control-Allow-Origin: http://YOUR_EC2_IP`.

**Cause 2: Nginx is not routing /api to PHP-FPM.**

Test whether the API responds locally on the server:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health
```

If the response is 404 or 502, review the Nginx configuration in `/etc/nginx/conf.d/camp-burnt-gin.conf`. Confirm the `location ~ ^/(api|sanctum)` block is present and that `fastcgi_pass unix:/run/php-fpm/www.sock` matches the actual socket path:

```bash
ls /run/php-fpm/www.sock
```

**Cause 3: PHP-FPM is not running.**

```bash
sudo systemctl status php-fpm
sudo systemctl start php-fpm
```

### API returns 500 errors

Check the Laravel log:

```bash
tail -50 /var/www/camp-burnt-gin/backend/storage/logs/laravel.log
```

A `Permission denied` error on the log file itself means the storage directory ownership is wrong. Fix it:

```bash
sudo chown -R ec2-user:nginx /var/www/camp-burnt-gin/backend/storage
sudo chmod -R 775 /var/www/camp-burnt-gin/backend/storage
```

A `DecryptException` error usually means the application key changed after encryption. Do not regenerate the key after the database contains encrypted data.

### Migrations fail

If a migration fails with a column or table not found error, check whether the migration references data that should have been created by an earlier migration:

```bash
cd /var/www/camp-burnt-gin/backend
php artisan migrate:status
```

Migrations shown as Pending have not run. Run them individually to isolate the failure:

```bash
php artisan migrate --path=database/migrations/SPECIFIC_FILE.php --force
```

If a data-fix migration fails because the data it targets does not match the current schema, you can mark it as run without executing it:

```bash
php artisan migrate:status  # note the batch number
php artisan db:table migrations  # view the migrations table directly
mysql -u root -p'YOUR_DB_PASSWORD' camp_burnt_gin \
  -e "INSERT INTO migrations (migration, batch) VALUES ('migration_file_name', BATCH_NUMBER);"
```

### Config cache permission errors

If `php artisan config:cache` fails with a permission error on `bootstrap/cache/`:

```bash
sudo chown -R ec2-user:nginx /var/www/camp-burnt-gin/backend/bootstrap/cache
sudo chmod -R 775 /var/www/camp-burnt-gin/backend/bootstrap/cache
```

### Frontend build fails locally due to type errors

Run the type checker separately to see all errors:

```bash
cd frontend
npx tsc --noEmit
```

Fix each reported error before attempting the build again. The build command (`npm run build`) runs TypeScript checking before the Vite compilation step, and it will not produce output if type errors exist.

---

## Part 11 — Operational Notes

### Stopping the EC2 instance

AWS charges for running instances. Stop the instance when not in use to avoid charges. Stopping (not terminating) the instance preserves its storage, configuration, and installed software. The public IP address changes on each start unless you attach an Elastic IP.

To stop: EC2 Console → Instances → select the instance → Instance State → Stop.

### Changing the default admin credentials

The database seeder creates a default super administrator account. Change the password immediately after first login via the profile settings page. Leaving the default password in place is a security risk, particularly on an internet-accessible server.

### HTTP only — no HTTPS

This deployment serves traffic over unencrypted HTTP. Auth tokens and all form data, including any PHI, travel in plaintext over the network. This is acceptable for internal classroom use where access is restricted, but must not be used for any real patient data or public-facing deployment.

To add HTTPS, install certbot and obtain a Let's Encrypt certificate, or place the instance behind an AWS Application Load Balancer with an ACM certificate.

### Queue workers are not running

The application uses a database-backed queue driver. Background jobs such as email delivery and async processing require a queue worker process. No queue worker is running in this deployment. If you need queued jobs to process, start a worker:

```bash
cd /var/www/camp-burnt-gin/backend
php artisan queue:work --daemon &
```

For a persistent worker that restarts on failure, install Supervisor and configure it to manage the queue:work process.

### Disk space

The instance disk is shared between the operating system, installed packages, the backend vendor directory, and the frontend node_modules directory. After a full deployment, approximately 1.5 GB of free space remains on an 8 GB root volume. Monitor disk usage and remove node_modules from the server if space becomes tight, as it is not needed after the build.

```bash
df -h /
```

### After changing .env

Any change to the backend `.env` file requires clearing and rebuilding the config cache:

```bash
cd /var/www/camp-burnt-gin/backend
php artisan config:clear
php artisan config:cache
```

### After updating the backend code

Pull the latest code and re-run the necessary steps:

```bash
cd /var/www/camp-burnt-gin
git pull
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
sudo systemctl reload nginx
```

### After updating the frontend code

Rebuild on your local machine and re-transfer:

```bash
cd frontend
npm run build
rsync -az --delete -e "ssh -i ~/Downloads/cbg-key.pem" \
  dist/ ec2-user@YOUR_EC2_IP:/var/www/camp-burnt-gin/frontend/dist/
```

---

## Reference — Confirmed System Versions

The following versions were confirmed running on the live deployment:

- Operating system: Amazon Linux 2023 (kernel 6.1)
- PHP: 8.2.30
- Composer: 2.9.5
- Laravel: 12.x
- Node.js: 20.20.2
- npm: 10.8.2
- Vite: 6.4.2
- React: 18.3.1
- Nginx: 1.28.2
- MySQL Community Server: 8.0.45

---

## Reference — Key File Paths on the Server

| Component | Path |
|-----------|------|
| Laravel root | /var/www/camp-burnt-gin/backend |
| Laravel public | /var/www/camp-burnt-gin/backend/public |
| Laravel environment | /var/www/camp-burnt-gin/backend/.env |
| Laravel logs | /var/www/camp-burnt-gin/backend/storage/logs/laravel.log |
| React build output | /var/www/camp-burnt-gin/frontend/dist |
| Nginx config | /etc/nginx/conf.d/camp-burnt-gin.conf |
| Nginx error log | /var/log/nginx/error.log |
| PHP-FPM socket | /run/php-fpm/www.sock |
| Swap file | /swapfile |
