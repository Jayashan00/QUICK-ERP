#!/usr/bin/env bash
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
/usr/bin/node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; new DatabaseSync(':memory:').close()"
install -D -m 0644 "$here/server.mjs" /opt/vyro-inquiries/server.mjs
install -m 0644 "$here/vyro-inquiries.service" /etc/systemd/system/vyro-inquiries.service
systemctl daemon-reload
systemctl enable vyro-inquiries.service
systemctl restart vyro-inquiries.service
