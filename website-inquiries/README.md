# Website inquiry inbox

Staff enter their website admin email and password at the normal /login page and are directed to /inquiry-admin. The website service owns its admin account and sessions.

## Local use

Use Node.js 22.13 or newer. From the project root run `node website-inquiries/server.mjs` and start the frontend in a second terminal. Restart an older running inquiry service after updating.

On first startup the service creates the account website-admin@vyro.com with a random password. Read `website-inquiries/private/initial-login.txt` locally for the credentials. The file is private and excluded from source control. Store the password in your password manager and remove this initial-login file when it is no longer needed. Authentication uses the salted password hash in admin-account.json.

To choose a different account email, set INQUIRY_ADMIN_EMAIL before the account is first created. Choose an email reserved for website administration. Existing accounts keep their configured email across restarts.

The login page uses the website account email to route website sign-ins. Other accounts continue through ERP sign-in. The website service must be running to sign in to the inbox. The old admin key is no longer accepted.

Sessions use HttpOnly, SameSite cookies, last eight hours, or seven days when Keep me signed in is checked, and are revoked on sign-out. Sessions survive service restarts. Expired sessions return the inbox to the login page.

## Server installation

The EC2 setup installs the inquiry service and nginx route. For an existing server, run `sudo bash website-inquiries/install.sh` from the release directory. Apply the website-specific map, rate limit and location from deploy/ec2/nginx-quickerp.conf to the active nginx configuration, validate and reload nginx, and publish the updated frontend. The website proxy must forward Host, X-Real-IP and X-Forwarded-Proto as shown. Serve the public site over HTTPS to protect passwords and enable Secure cookies. For later changes to the inquiry service, rerun the installer.

Read initial credentials on the server with `sudo cat /var/lib/vyro-inquiries/initial-login.txt`. Keep credentials and database files outside the web root. Back up the service's private directory while it is stopped, or use SQLite's online backup for the database. ERP database backups do not include the website inbox.

Existing inquiry records remain in the same database. Old browser preview entries stay on the device where they were created.
