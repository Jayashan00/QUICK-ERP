#!/usr/bin/env bash
# Daily database backup. Install once:  sudo cp backup-database.sh /etc/cron.daily/quickerp-backup && sudo chmod +x /etc/cron.daily/quickerp-backup
# Backups are kept 14 days in /var/backups/quickerp. Copy them off the server too (for example to Amazon S3).
set -euo pipefail
mkdir -p /var/backups/quickerp
sudo -u postgres pg_dump -Fc quickerp > "/var/backups/quickerp/quickerp-$(date +%Y%m%d-%H%M).dump"
find /var/backups/quickerp -name 'quickerp-*.dump' -mtime +14 -delete
# Restore a backup:  sudo -u postgres pg_restore --clean --if-exists -d quickerp /var/backups/quickerp/<file>.dump
