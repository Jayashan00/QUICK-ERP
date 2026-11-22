#!/usr/bin/env bash
# Quick ERP (Vyro) on a SHARED server that already runs Caddy through its admin API (for example the
# Hostinger VPS that also hosts the Quicke platform). Nothing else on the server is changed:
#   - no nginx (Caddy keeps ports 80/443), no change to Node.js, MariaDB or the mail server;
#   - the site is added to Caddy as ONE route with its own id, the same way the Quicke platform adds stores;
#   - every existing website is checked before and after, and the route is removed again if any of them changes.
#
# Usage (from the project folder):   sudo bash deploy/vps/setup-vps.sh vyroerp.com
# Safe to run again: it keeps the existing settings, database and passwords.
set -euo pipefail

DOMAIN="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PACKAGE="$(cd "$HERE/../.." && pwd)"
ENV_FILE=/etc/quickerp/backend.env
WEB=/var/www/vyroerp
ROUTE_ID=vyroerp-erp
CADDY=http://localhost:2019
STAMP="$(date +%Y%m%d-%H%M%S)"

step() { printf '\n==== %s\n' "$1"; }
die() { echo "STOPPED: $1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo"
[ -n "$DOMAIN" ] || die "give the domain: sudo bash deploy/vps/setup-vps.sh vyroerp.com"
[ -d "$PACKAGE/backend" ] && [ -d "$PACKAGE/frontend" ] || die "run this from the project folder"

# ------------------------------------------------------------------ checks
step "0/9 Checking the server (nothing is changed yet)"
curl -fs -m 5 "$CADDY/config/" >/dev/null || die "the Caddy admin API ($CADDY) does not answer"
command -v node >/dev/null || die "Node.js is not installed (the website inquiry service needs Node 22.13 or newer)"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' \
  || die "Node.js $(node -v) is too old; 22.13 or newer is needed (not upgraded automatically: other apps use it)"
if [ ! -f "$ENV_FILE" ]; then
  for port in 8000 8011 5432; do
    ss -tln | grep -qE "[:.]$port\s" && die "port $port is already used by another program"
  done
fi
# Port 8000/8011 are not referenced by any other site's Caddy route (would expose our services there).
curl -fs "$CADDY/config/apps/http/servers" | python3 -c "
import json,sys
cfg=json.load(sys.stdin); text=json.dumps(cfg)
for port in ('127.0.0.1:8000','127.0.0.1:8011','localhost:8000','localhost:8011'):
    for name,srv in cfg.items():
        for r in srv.get('routes',[]):
            if r.get('@id')!='$ROUTE_ID' and port in json.dumps(r):
                sys.exit('STOPPED: Caddy route %s already forwards to %s' % (r.get('@id'), port))
" || exit 1
PUBLIC_IP="$(curl -fs -m 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
if [ "$DNS_IP" != "$PUBLIC_IP" ]; then
  echo "WARNING: $DOMAIN points to '${DNS_IP:-nothing}', this server is $PUBLIC_IP."
  echo "         The site will work, but HTTPS starts only once the DNS record points here (DNS only / grey cloud)."
fi
curl -fs "$CADDY/config/" > "/root/caddy-config-before-vyroerp-$STAMP.json"
echo "Caddy configuration backed up to /root/caddy-config-before-vyroerp-$STAMP.json"

# ------------------------------------------------------------------ packages
step "1/9 Installing Java 21 and PostgreSQL (only new packages; nothing replaced)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q openjdk-21-jdk-headless postgresql curl openssl ca-certificates python3

step "2/9 Swap memory for builds"
if [ "$(swapon --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Added 4 GB swap."
else
  echo "Swap already present."
fi

step "3/9 System user and folders"
id quickerp >/dev/null 2>&1 || useradd --system --home /opt/quickerp --shell /usr/sbin/nologin quickerp
mkdir -p /opt/quickerp /opt/quickerp/releases /etc/quickerp "$WEB" /var/backups/quickerp
chown quickerp:quickerp /opt/quickerp

step "4/9 Settings and secrets ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  STARTER_PASSWORD="Qe-$(openssl rand -hex 8)-Rp"
  cat > "$ENV_FILE" <<EOF
APP_ENVIRONMENT=production
SERVER_ADDRESS=127.0.0.1
PORT=8000
DB_URL=jdbc:postgresql://localhost:5432/quickerp
DB_USERNAME=quickerp
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
CORS_ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
PASSWORD_RESET_URL=https://$DOMAIN/reset-password
SEED_ENABLED=true
SEED_DEMO_DATA=false
SEED_DEFAULT_PASSWORD=$STARTER_PASSWORD
NEW_USER_INITIAL_PASSWORD=
MAIL_FROM=no-reply@$DOMAIN
SPRING_MAIL_HOST=
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=
SPRING_MAIL_PASSWORD=
SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH=true
SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE=true
# AI assistant (backend only). Add the key, then: sudo systemctl restart quickerp-backend
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
AI_MAX_HISTORY_MESSAGES=12
EOF
  chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
  echo "Created $ENV_FILE with new random passwords."
else
  echo "Keeping the existing $ENV_FILE."
fi
DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"

step "5/9 Database (PostgreSQL, separate from MariaDB)"
systemctl enable --now postgresql >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -v pw="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE quickerp LOGIN PASSWORD %L', :'pw') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quickerp') \gexec
SELECT format('ALTER ROLE quickerp LOGIN PASSWORD %L', :'pw') \gexec
SELECT 'CREATE DATABASE quickerp OWNER quickerp' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'quickerp') \gexec
SQL

step "6/9 Building the backend (first time: several minutes)"
cd "$PACKAGE/backend"
chmod +x mvnw
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
./mvnw -B -q -DskipTests clean package
install -o quickerp -g quickerp -m 0644 target/quick-erp-backend.jar /opt/quickerp/quick-erp-backend.jar

step "7/9 Building the website"
cd "$PACKAGE/frontend"
npm ci --no-audit --no-fund
VITE_API_BASE_URL="/api/v1" VITE_USE_MOCKS="false" npm run build
rm -rf "$WEB.new" && cp -r dist "$WEB.new" && chmod -R a+rX "$WEB.new"
rm -rf "$WEB.old"; [ -d "$WEB" ] && mv "$WEB" "$WEB.old"; mv "$WEB.new" "$WEB"; rm -rf "$WEB.old"

step "8/9 Starting the backend and the website inquiry service"
# Shared server: Java may use at most 1 GB, so the other websites keep their memory.
sed 's/-XX:MaxRAMPercentage=60/-Xms256m -Xmx1g/' "$PACKAGE/deploy/ec2/quickerp-backend.service" > /etc/systemd/system/quickerp-backend.service
systemctl daemon-reload
systemctl enable quickerp-backend >/dev/null
systemctl restart quickerp-backend
echo -n "Waiting for the backend"
for _ in $(seq 1 90); do
  if curl -fs http://127.0.0.1:8000/api/v1/health >/dev/null; then echo " - running."; break; fi
  echo -n "."; sleep 2
done
curl -fs http://127.0.0.1:8000/api/v1/health >/dev/null || die "the backend did not start. See: journalctl -u quickerp-backend -n 100"
bash "$PACKAGE/website-inquiries/install.sh"
systemctl is-active --quiet vyro-inquiries || die "the inquiry service did not start. See: journalctl -u vyro-inquiries -n 50"

step "9/9 Adding $DOMAIN to Caddy (existing websites are checked before and after)"
python3 "$HERE/caddy-route.py" "$DOMAIN" "$WEB" "$ROUTE_ID" "$CADDY"

STARTER_PASSWORD="$(grep '^SEED_DEFAULT_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
cat <<EOF

=====================================================================
 Quick ERP is running:  https://$DOMAIN
 Super Admin email:     superadmin@vyroerp.com
 Super Admin password:  $STARTER_PASSWORD

 This is the only account. Sign in, change this password (Security page), then
 create companies under Tenants: activating a company creates it with all roles
 and shows its administrator's sign-in details once.
 Settings file:   $ENV_FILE   (then: sudo systemctl restart quickerp-backend)
 Backend log:     sudo journalctl -u quickerp-backend -f
 Remove the site from Caddy again:  sudo python3 $HERE/caddy-route.py --remove $ROUTE_ID
=====================================================================
EOF
