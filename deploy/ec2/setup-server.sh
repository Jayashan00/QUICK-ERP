#!/usr/bin/env bash
# Quick ERP: installs everything on a new Ubuntu 24.04 server (AWS EC2) and starts it.
#
#   With a domain (recommended, enables HTTPS):  sudo ./setup-server.sh erp.yourcompany.lk you@yourcompany.lk
#   Without a domain (testing only, http):        sudo ./setup-server.sh
#
# Run it from the QUICK-ERP-Complete folder's deploy/ec2 directory. It is safe to run again after an
# update: passwords and data are kept, the backend and frontend are rebuilt and restarted.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PACKAGE="$(cd "$HERE/../.." && pwd)"
ENV_FILE=/etc/quickerp/backend.env

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo $0 $*"; exit 1; }
[ -d "$PACKAGE/backend" ] && [ -d "$PACKAGE/frontend" ] || { echo "Run this from QUICK-ERP-Complete/deploy/ec2"; exit 1; }
if [ -n "$DOMAIN" ] && [ -z "$EMAIL" ]; then echo "Give an email for the HTTPS certificate: sudo $0 $DOMAIN you@example.com"; exit 1; fi

step() { printf '\n==== %s\n' "$1"; }

step "1/8 Installing Java 21, PostgreSQL, nginx and Node.js 22"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q openjdk-21-jdk-headless postgresql nginx curl unzip openssl ca-certificates
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

step "2/8 Creating the quickerp system user and folders"
id quickerp >/dev/null 2>&1 || useradd --system --home /opt/quickerp --shell /usr/sbin/nologin quickerp
mkdir -p /opt/quickerp /etc/quickerp /var/www/quickerp
chown quickerp:quickerp /opt/quickerp

step "3/8 Settings and secrets (kept in $ENV_FILE)"
if [ -n "$DOMAIN" ]; then SITE="https://$DOMAIN"; ENVIRONMENT=production; else
  SITE="http://$(curl -fs -m 3 http://checkip.amazonaws.com || hostname -I | awk '{print $1}')"; ENVIRONMENT=development; fi
if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  STARTER_PASSWORD="Qe-$(openssl rand -hex 8)-Rp"
  cat > "$ENV_FILE" <<EOF
APP_ENVIRONMENT=$ENVIRONMENT
SERVER_ADDRESS=127.0.0.1
PORT=8000
DB_URL=jdbc:postgresql://localhost:5432/quickerp
DB_USERNAME=quickerp
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
CORS_ALLOWED_ORIGINS=$SITE
PASSWORD_RESET_URL=$SITE/reset-password
SEED_ENABLED=true
SEED_DEMO_DATA=false
SEED_DEFAULT_PASSWORD=$STARTER_PASSWORD
NEW_USER_INITIAL_PASSWORD=
MAIL_FROM=no-reply@${DOMAIN:-quickerp.local}
# Email (password reset links). Fill in your SMTP server, then: sudo systemctl restart quickerp-backend
SPRING_MAIL_HOST=
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=
SPRING_MAIL_PASSWORD=
SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true
EOF
  chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
  echo "Created $ENV_FILE with new random passwords."
else
  echo "Keeping the existing $ENV_FILE."
fi
DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

step "4/8 Database"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -v pw="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE quickerp LOGIN PASSWORD %L', :'pw') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quickerp') \gexec
SELECT format('ALTER ROLE quickerp LOGIN PASSWORD %L', :'pw') \gexec
SELECT 'CREATE DATABASE quickerp OWNER quickerp' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'quickerp') \gexec
SQL

step "5/8 Building the backend (first time: several minutes)"
cd "$PACKAGE/backend"
chmod +x mvnw
./mvnw -B -q -DskipTests clean package
install -o quickerp -g quickerp -m 0644 target/quick-erp-backend.jar /opt/quickerp/quick-erp-backend.jar

step "6/8 Building the frontend"
cd "$PACKAGE/frontend"
npm ci --no-audit --no-fund
VITE_API_BASE_URL="/api/v1" VITE_USE_MOCKS="false" npm run build
rm -rf /var/www/quickerp/*
cp -r dist/. /var/www/quickerp/

step "7/8 Starting the backend service"
install -m 0644 "$HERE/quickerp-backend.service" /etc/systemd/system/quickerp-backend.service
systemctl daemon-reload
systemctl enable quickerp-backend >/dev/null
systemctl restart quickerp-backend
echo -n "Waiting for the backend"
for _ in $(seq 1 90); do
  if curl -fs http://127.0.0.1:8000/api/v1/health >/dev/null; then echo " - running."; break; fi
  echo -n "."; sleep 2
done
curl -fs http://127.0.0.1:8000/api/v1/health >/dev/null || { echo; echo "The backend did not start. See: sudo journalctl -u quickerp-backend -n 100"; exit 1; }

step "8/8 Web server${DOMAIN:+ and HTTPS for $DOMAIN}"
sed "s/__SERVER_NAME__/${DOMAIN:-_}/" "$HERE/nginx-quickerp.conf" > /etc/nginx/sites-available/quickerp
ln -sf /etc/nginx/sites-available/quickerp /etc/nginx/sites-enabled/quickerp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
if [ -n "$DOMAIN" ]; then
  apt-get install -y -q certbot python3-certbot-nginx
  certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN"
fi

STARTER_PASSWORD="$(grep '^SEED_DEFAULT_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
cat <<EOF

=====================================================================
 Quick ERP is running:  $SITE
 Sign in as:            admin@quickerp.test
 Password:              $STARTER_PASSWORD
 (Super Admin console:  superadmin@quickerp.test, same password)

 Change these passwords right after signing in (Security page).
 Settings file:   $ENV_FILE   (then: sudo systemctl restart quickerp-backend)
 Backend log:     sudo journalctl -u quickerp-backend -f
=====================================================================
EOF
[ -z "$DOMAIN" ] && echo "No domain given: this is http only and runs in development mode. Use a domain for live use."
exit 0
