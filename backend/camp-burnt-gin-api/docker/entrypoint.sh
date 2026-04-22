#!/usr/bin/env bash
set -e

# Wait for MySQL to be ready before doing anything
echo "Waiting for MySQL..."
until mysqladmin ping -h "${DB_HOST:-mysql}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD:-password}" --silent 2>/dev/null; do
    sleep 1
done
echo "MySQL is ready."

# Generate APP_KEY if not already set (checks env var and .env file)
ENV_FILE="/var/www/html/.env"
ENV_KEY_VALUE=$(grep "^APP_KEY=" "${ENV_FILE}" 2>/dev/null | cut -d'=' -f2-)
if [ -z "${APP_KEY:-$ENV_KEY_VALUE}" ]; then
    echo "No APP_KEY found — generating application key..."
    php artisan key:generate --force
fi

# Run migrations (--force required for non-interactive environments)
echo "Running migrations..."
php artisan migrate --force

# Cache config, routes, and views in production so the runtime image has
# pre-compiled bootstrapping. Skipped in local/development so that .env
# changes take effect without requiring a manual cache:clear.
if [ "${APP_ENV:-local}" = "production" ]; then
    echo "Caching config, routes, and views for production..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

# Start the development server
exec php artisan serve --host=0.0.0.0 --port=8000
