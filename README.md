# SJAA Student ID Issuance System

**A web-based student application, ID review, and card-printing system for San Jose Adventist Academy.**

**Created by Crisjan Alleh Prado**

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![MariaDB](https://img.shields.io/badge/Database-MariaDB%20%2F%20MySQL-003545)
![License](https://img.shields.io/badge/License-MIT-green)

This project digitizes the student ID issuance workflow: students apply using a
QR/link, administrators review applications and photos, approved applications
are printed as CR80 ID cards, and administrators record when cards are claimed.
It is a school workflow tool, not a student information system: students do not
have accounts or sign in.

## Features

- Encrypted-at-rest QR/link access tokens for student application forms, with
  authenticated viewing and sharing of active links.
- Student information, required student email, and required ID-photo submission
  with image validation and private photo storage.
- Administrator login and profile editing, application review, rejection, office photo replacement,
  and claiming workflow.
- Editable ID card template with portrait/landscape CR80 cards, an optional
  authorized signatory image, adjustable front-card photo/name layout, and
  paginated duplex batches.
- Rejection and ready-for-claiming email notifications with a retryable admin
  notification log.
- Audit history, session and CSRF protection, request throttling, and duplicate
  application protection.
- Student-facing application forms stay in a light theme; track/strand is
  enabled only for Grades 11–12. Private contact details remain in the
  application record and are intentionally excluded from the printed card.

## Technology

- Next.js App Router, React, and TypeScript
- MariaDB/MySQL through Drizzle ORM and `mysql2`
- Nodemailer for SMTP email
- `sharp` for photo processing

On Windows, the database can run through XAMPP's **MySQL** control-panel entry
(XAMPP distributes MariaDB). HeidiSQL is an optional graphical tool to create
and inspect the database. The application itself runs with Node.js; XAMPP
Apache is not required.

## Requirements

- Node.js 20 or newer with npm
- XAMPP with MariaDB/MySQL running locally, or a compatible MySQL 8+/MariaDB
  server
- HeidiSQL (optional, for the graphical database setup below)
- SMTP account/server details if you want to send real email

## Local setup on Windows (XAMPP + HeidiSQL)

The commands below run in the **VS Code integrated terminal**. To open it, open
this project folder in VS Code and click **Terminal → New Terminal**. Confirm
the prompt is in the project folder before running commands.

### 1. Start the database

1. Open **XAMPP Control Panel** from the Windows Start menu.
2. In the **MySQL** row, click **Start** and wait for its status to show
   **Running**.
3. Leave Apache stopped; Next.js serves the website itself.

### 2. Create the database with HeidiSQL

1. Open **HeidiSQL** from the Start menu.
2. Create or select a local session with:
   - Network type: **MariaDB or MySQL (TCP/IP)**
   - Hostname / IP: `127.0.0.1`
   - User: `root`
   - Password: blank if you have not set a root password in XAMPP
   - Port: `3306`
3. Click **Open** to connect.
4. Open a **Query** tab and run the following SQL (press **F9** or click
   **Execute**):

   ```sql
   CREATE DATABASE sjaa_id_system
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

5. Refresh the database tree and confirm `sjaa_id_system` appears.

The default `root` account is convenient for a local laptop test. For a shared
or production deployment, create a dedicated database user with only the
privileges needed for this application; do not expose the database to the
public internet.

### 3. Install packages and create `.env`

In VS Code, choose **Terminal → New Terminal** and run:

```powershell
npm install
Copy-Item .env.example .env
```

If PowerShell says `.env` already exists, do not overwrite it; open the existing
`.env` from VS Code's Explorer instead.

### 4. Configure the application

Open `.env` in VS Code and set the database connection. With XAMPP's default
local root account (no password), use:

```dotenv
DATABASE_URL=mysql://root@127.0.0.1:3306/sjaa_id_system
APP_URL=http://localhost:3000
APP_SECRET=REPLACE_WITH_A_RANDOM_64_CHARACTER_HEX_VALUE
```

If your MySQL root account has a password, include it in the URL. URL-encode
characters such as `@`, `#`, `/`, or `:` in the password:

```dotenv
DATABASE_URL=mysql://root:your-url-encoded-password@127.0.0.1:3306/sjaa_id_system
```

Generate a random `APP_SECRET` in the VS Code terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `APP_SECRET`. Keep `.env` private; never commit credentials
or real secrets to GitHub. The `.env.example` file is a template and is not
loaded automatically by the app.

### 5. Create the application tables

Keep XAMPP's MySQL service running. In the VS Code terminal, from the project
folder, run:

```powershell
npx drizzle-kit push
```

Drizzle reads `DATABASE_URL` from `.env` via `drizzle.config.ts` and creates or
updates the tables in `sjaa_id_system`. This project uses MariaDB-compatible
datetime columns, generated columns, and indexes.

If you see `DATABASE_URL is required`, check that:

- the file is named exactly `.env`, not `.env.example` or `.env.txt`;
- it is in the project root beside `package.json` and `drizzle.config.ts`;
- it includes a non-empty `DATABASE_URL=mysql://...` line; and
- the VS Code terminal's current directory is the project folder.

If the error is a connection refusal or access denied, verify that XAMPP MySQL
is **Running**, that HeidiSQL connects with the same host/port/user/password,
and that the database name in the URL is `sjaa_id_system`.

If updating an existing installation that was set up before the orientation
selector was added, run this additive migration once before starting the app:

```powershell
npm run db:migrate:orientation
```

It adds the `orientation` column to `id_template_config` with the existing
landscape layout as the default. It is safe to run again; it does not drop data.
New installations already receive the column from `drizzle-kit push`.

For installations receiving the signature and optional layout controls, also
run this additive migration once:

```powershell
npm run db:migrate:template-design
```

It adds the nullable `design_settings` JSON column. Existing templates and
print batches remain unchanged; new batches snapshot the settings used at
creation. The migration is safe to repeat.

For installations adding administrator profiles and reusable sharing of active
application links, run this additive migration once:

```powershell
npm run db:migrate:admin-profile-sharing
```

It adds encrypted token recovery storage and a separate administrator profile
table for resized profile photos, with enough storage capacity for normalized
images. Existing token hashes are one-way and cannot
be recovered; regenerate an existing active token once if it needs to be
viewed or shared again. Keep `APP_SECRET` unchanged and backed up: encrypted
token links cannot be decrypted if that secret is lost or rotated. The
migration is safe to repeat.

Administrators can access their profile, theme toggle, and sign-out controls
from the floating **Workspace** menu. Student application forms follow the
student device&rsquo;s light/dark preference and remain responsive on mobile.

### 6. Create the first administrator

Run:

```powershell
npx tsx scripts/create-admin.ts
```

Enter the requested username, full name, email address, and password. The
password must be at least 12 characters. There is intentionally no default
administrator account or password. The alternative one-time `/setup` page
requires configuring `SETUP_SECRET` first; the interactive CLI is simpler for
local use.

### 7. Start the application and sign in

Run:

```powershell
npm run dev
```

Keep this terminal open while the application is running. Visit
`http://localhost:3000/api/health`; a healthy database connection returns:

```json
{"ok":true}
```

Then open `http://localhost:3000/admin/login` and sign in with the
administrator credentials created in step 6.

To stop the development server, focus its terminal and press **Ctrl+C**.

## Share a test deployment

GitHub stores and shares the source code; it does not run this application.
Links containing `localhost` work only on the computer running the app. For
friends to test from their own devices, deploy the app to a reachable server and
use its public HTTPS address.

The deployment must provide:

- A Node.js 20+ server that can run the Next.js production build and `sharp`.
- A MySQL/MariaDB database reachable privately by that server.
- Persistent storage mounted so `storage/photos` survives rebuilds and restarts.
  Student photos are stored on disk outside the public web root; ephemeral
  serverless file storage is not suitable for this setup.
- HTTPS, a strong private `APP_SECRET`, and production environment variables
  for the database, SMTP, session settings, and `APP_URL`. Never put `.env`,
  database credentials, mail app passwords, or real student records in GitHub.

When the deployment provides a stable address (for example,
`https://your-app.example.com`):

1. Configure that URL as the deployment's `APP_URL` environment variable, with
   no trailing slash, then rebuild/restart the app.
2. Configure `DATABASE_URL` to the hosted MySQL/MariaDB database, not the
   XAMPP server on your laptop. Keep the database private to the app server.
3. Set `APP_SECRET` and the working Gmail SMTP environment variables in the
   hosting provider's secret/environment settings. Use the same stable secret
   across restarts and back it up securely.
4. Apply schema migrations to that hosted database and create a separate test
   administrator. Do not copy production student records to a demo instance.
5. Open the public URL and test the form. Generate a fresh QR code after
   setting `APP_URL`; newly generated/revealed links will use the public host.
   Previously downloaded QR images that contain `localhost` must be replaced.
6. Share the public application link or fresh QR image with testers. Share the
   admin URL and credentials only with trusted people, using a separate test
   account and fake student data.

Before inviting testers, confirm the host's persistent-disk and database
support. GitHub Pages alone cannot host this Next.js API/database application.

## Configure and test email notifications

**Email is not sent until you configure a real SMTP service.** The values in
`.env.example` are intentionally blank. XAMPP does not provide an SMTP email
server, and installing HeidiSQL does not configure email. The app cannot send
email just because the student record contains an email address.

Notifications are sent when an administrator **rejects** a student photo or
creates a **print batch** (ready-for-claiming message). Submission by itself
does not send a confirmation email. A missing recipient address also prevents
delivery. All attempts and errors are recorded under the admin area's
**Notifications** page.

In `.env`, set the SMTP details supplied by your email provider:

```dotenv
MAIL_HOST=your-provider-smtp-host
MAIL_PORT=587
MAIL_USERNAME=your-smtp-login
MAIL_PASSWORD=your-smtp-password-or-app-password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=an-address-your-provider-allows
MAIL_FROM_NAME=San Jose Adventist Academy
```

For a Gmail account, a common configuration is `MAIL_HOST=smtp.gmail.com`,
`MAIL_PORT=587`, `MAIL_ENCRYPTION=tls`, your full Gmail address as both
`MAIL_USERNAME` and `MAIL_FROM_ADDRESS`, and a **Google App Password** as
`MAIL_PASSWORD` (not your normal Google account password; Google requires
2-Step Verification for App Passwords). Provider requirements can change;
follow the provider's current SMTP and app-password instructions. If using
another provider, use its SMTP host, port, and authentication settings.

Use `MAIL_ENCRYPTION=tls` for STARTTLS on port 587. Use `ssl` for implicit TLS,
commonly on port 465. `MAIL_USERNAME` and `MAIL_PASSWORD` must either both be
set or both be blank for a relay that allows unauthenticated local delivery.

After changing `.env`, stop and restart `npm run dev` so Next.js reloads the
environment. Then verify SMTP and send a test message to an address you control:

```powershell
npm run test:email -- your-address@example.com
```

“SMTP accepted” means the provider accepted the message for delivery; check the
recipient inbox and spam folder. If this command reports a connection,
authentication, or TLS error, verify the host/port/encryption and credentials
with your mail provider. Never paste SMTP passwords or app passwords into GitHub
or support messages.

After SMTP works, return to the app and use **Admin → Notifications → Retry**
for any failed notification. Updating `.env` does not automatically resend old
messages.

## Test the main workflow

1. Sign in to the admin site.
2. Open **QR Codes**, create a token, and copy its application URL. Active
   links created after the profile-sharing migration can be reopened and shared
   from the token registry.
3. Open that URL in a separate/private browser window.
4. Fill in a test student application, including a valid photo, and submit.
5. Return to the admin window and open **Applications**.
6. Open the test application and approve or reject it. A rejection should create
   a notification event; with SMTP configured, it should deliver an email.
7. In **ID Template**, optionally upload an authorized signatory&rsquo;s PNG/JPG
   signature image and adjust the student-name/photo size and position using the
   collapsed **Optional card layout adjustments** controls. The signature is a
   visual image, not a cryptographically verified or legally authenticated
   digital signature.
8. For printing, approve several test applications, open **Batch Print**, select
   approved records on the current page (up to 20), and create a batch. Larger
   queues are paginated; print one batch at a time. The system rechecks record
   eligibility and keeps the front/back card order consistent.
9. Open the batch and click **Print cards**. The page waits for student photos
   to finish loading before opening the print dialog. Choose A4 and 100% scale,
   disable browser headers/footers, and verify front/back alignment in print
   preview before printing. Duplex alignment depends on printer settings, so
   test with sample records first.
10. After handover, mark the printed record as claimed.

Avoid entering real student personal information in a personal/development
instance unless the school has approved its use and data handling.

## Project structure

```text
src/app/          Next.js pages and API routes
src/components/   Shared interface and ID card components
src/db/           Drizzle MariaDB/MySQL connection and schema
src/lib/           Authentication, validation, email, photo, token, and audit logic
scripts/           Administrator bootstrap, migrations, and SMTP test utilities
storage/photos/    Private uploaded photos (not served as public static files)
```

## Interface design

The admin workspace uses a compact institutional masthead and a horizontal,
scrollable navigation bar rather than a persistent sidebar. Student forms use
grouped sections, clear preparation guidance, inline validation, consent, and a
submission confirmation that highlights the application control number.

## Useful commands

```powershell
npm run dev          # local development server
npm run typecheck    # TypeScript validation
npm run lint         # ESLint
npm run build        # optimized production build
npm run start        # serve a production build
npm run test:email -- your-address@example.com
```

## Security and deployment notes

- Set `APP_URL` to the public HTTPS origin in production. Secure cookies and
  HSTS behavior depend on the configured URL.
- Use a strong `APP_SECRET` and a least-privilege database account.
- Keep `.env`, database backups, and student photos out of version control.
- Keep `storage/` private and outside the public web root.
- Set `TRUSTED_PROXY=true` only when deployed behind a trusted proxy configured
  to set client IP headers correctly.
- Configure SMTP with credentials specifically intended for the application.
- Use a maintained Node.js, MariaDB/MySQL, and dependency version before
  deploying publicly.
- Do not expose a development server or XAMPP database directly to the internet.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
