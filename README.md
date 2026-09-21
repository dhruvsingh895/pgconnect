# PGConnect

A responsive PG / hostel workspace for owners and tenants, built with **Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, PostgreSQL, and Prisma**.

All project source, dependencies, local database files, demo workspaces, browser profiles, screenshots, and npm cache are contained in this `product` directory. Nothing is deployed automatically.

## Open the app

The development app runs at **http://127.0.0.1:3000**.

```powershell
npm install
npm run db:generate
npm run dev
```

Choose **Owner demo** or **Tenant demo** on the sign-in page to explore immediately. Each demo opens an isolated, server-side workspace in `.data/demo`. It is saved across page reloads and never modifies regular accounts. Demo sessions expire after 15 minutes; sign in to a new demo to reset the sample data. Demo routes and demo buttons are disabled in production, regardless of `DEMO_ENABLED`.

## Local PostgreSQL setup

This machine has PostgreSQL 17 installed. An isolated PGConnect instance has been initialized under `.data/postgres`, listening only on **127.0.0.1:54329**, with SCRAM password authentication. It does not modify the machine's existing PostgreSQL databases or install a service.

```powershell
npm run setup:local
npm run db:migrate
npm run db:seed
npm run dev
```

`setup:local` generates random local secrets in the ignored `.env` file and preserves existing configuration. Set `POSTGRES_BIN` if PostgreSQL is installed elsewhere. On a different platform, provision PostgreSQL and configure `DATABASE_URL` directly.

The seeded owner is `owner@pgconnect.example`. The seeded tenant is `aarav@example.com`. Their password is the random **SEED_PASSWORD** in your local `.env`; no shared password is committed. You can also create your own email account from the sign-in page.

To stop only this local database:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D '.data/postgres' stop -m fast
```

The database, caches and private `.env` must not be committed or shared. `.gitignore` excludes them.

## Workflows

### Appearance

Use the sun, moon, and monitor controls on sign-in or in the dashboard header to choose **Light**, **Dark**, or **System**. Settings and My profile also have a labeled Appearance selector. The preference is saved on this device and synchronized across tabs. System mode responds to device-theme changes. A small pre-paint script applies the preference before the page displays, avoiding a bright flash in dark mode. If browser storage is blocked, switching still works for the current page.

Theme colors are defined in `src/app/themes.css`; shared components use semantic surface, text, border, accent, and status tokens. `npm run test:theme` checks theme persistence, system changes, tab synchronization, owner pages, modals, mobile widths, and blocked-storage behavior. Screenshots are saved in `.data/qa`.

**Owners:** create a PG, share the invite code/link, assign tenant rooms and beds, set rent/deposit, inspect payment history and private KYC documents, mark rent paid/pending, generate monthly rent, send simulated WhatsApp-style in-app reminders, publish targeted announcements, inspect read/unread status, edit a weekly menu, resolve complaints with notes, and manage property settings.

**Tenants:** join with an invite, add a move-in date and phone contact, upload private KYC from My profile, view only their own rent and payment history, raise complaints with optional photos, follow resolution activity, view meals, read relevant announcements, and edit their display name.

The owner assigns rooms and rates after a tenant joins. Rent is recorded by the owner; no payment gateway or financial transaction is simulated as a real payment. Reminders are in-app notifications, not real WhatsApp messages. Staff/sub-admin access was optional in the brief and is not enabled.

**Rent policy:** amounts are integer rupees, due on the fifth, and billed at the full monthly rate without prorating. Creating a monthly cycle is idempotent and skips tenants whose move-in month is later, whose room is still unassigned, or whose rate has not yet been set. The current cycle is generated on the first dashboard request of each month; this is lazy generation, not a background scheduler. Editing a tenant's rate affects subsequently generated cycles, not existing obligations. Reminders are limited to one per tenant per 24 hours and respect the property's reminder preference.

## Configuration

Copy `.env.example` to `.env` if you are not using `setup:local`.

| Variable                                        | Purpose                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                                  | PostgreSQL connection URL; use TLS for hosted databases                  |
| `APP_ORIGIN`                                    | Exact trusted app origin, including scheme; must use HTTPS in production |
| `JWT_SECRET`                                    | Random signing/HMAC secret, at least 32 characters                       |
| `ENCRYPTION_KEY`                                | 32-byte AES key encoded as 64 hex characters                             |
| `DEMO_ENABLED`                                  | Development demo switch; always disabled in production                   |
| `SEED_PASSWORD`                                 | Local seed password, at least 12 characters                              |
| `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM` | Twilio SMS credentials and a compliant sender                            |
| `S3_REGION`, `S3_BUCKET`                        | Private AWS S3 bucket configuration                                      |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`    | Local AWS credentials; use a workload IAM role in production             |
| `POSTGRES_BIN`                                  | Optional local Windows PostgreSQL binary directory                       |

Do not rotate `ENCRYPTION_KEY` without re-encrypting existing phone data. Changing `JWT_SECRET` invalidates sessions and changes HMAC lookups; migrating those values requires a deliberate key-rotation procedure.

## SMS and private storage

Email/password authentication works with PostgreSQL alone. Phone sign-in needs the SMS provider configuration, including sender/template registration appropriate for India. OTPs are random, expire after five minutes, are stored only as keyed hashes, have five verification attempts, and are consumed once. There is no fixed code, debug-code response, or plaintext code logging.

For S3, enable **Block Public Access**, server-side encryption, and a least-privilege IAM policy scoped to the private application prefix. Set bucket CORS to your exact `APP_ORIGIN`, allow `POST`, and allow the fields/headers required by the presigned form. Upload URLs expire in two minutes and constrain content type and size. Completion checks object metadata and file signatures before accepting the document. Authorized downloads expire in 60 seconds and use attachment disposition. KYC accepts PDF/JPEG/PNG up to 5 MB; complaint and announcement attachments accept JPEG/PNG only.

SMS delivery and S3 round trips have **not been live-tested** because provider credentials were not supplied. Configure and test them before release. For a public production deployment, add the organization's malware-scanning and retention policies before serving uploaded documents; signature validation is not malware scanning.

## Architecture

```text
prisma/
  schema.prisma                 Relational models and tenant/property links
  migrations/                   Versioned initial SQL migration
  seed.ts                       Idempotent sample data
src/app/
  api/                          Thin HTTP controllers
  [role]/[page]/                 Dashboard routes
  login/, onboarding/           Identity and joining flows
src/features/
  auth/, dashboard/, tenants/, rent/, complaints/
  announcements/, food/, settings/, uploads/, demo/
src/components/ui/              Modal, badges, tables, cards, empty/loading states
src/lib/                        Shared types, formatting, HTTP client
src/server/
  auth/                         Cookie sessions, refresh rotation, policy, rate limiting
  services/                     Validated workflow operations
  repositories/                 Data persistence
  config.ts, crypto.ts, http.ts  Configuration, encryption, errors/CSRF
tests/                          Domain, API, database and browser checks
scripts/                        Project-local PostgreSQL setup
```

Mutation handlers validate Zod discriminated unions before running services. Property data is scoped on the server. Tenant responses exclude other tenants, payments, complaints, read receipts, notifications, and invite codes. The PostgreSQL dashboard repository uses optimistic revision checks and transactions to avoid lost updates; the local demo repository serializes writes and uses atomic replacement.

The dashboard repository currently loads an aggregate property workspace before applying authorization filters. It suits small/medium properties; introduce indexed, paginated repository queries and per-operation updates before supporting very large portfolios.

## Security behavior

- Bcrypt password hashes; 15-minute access JWTs and rotating 7-day opaque refresh tokens.
- HTTP-only, SameSite=Lax cookies; Secure in production. JWT payloads contain only identity/session claims.
- Server-side active-family checks revoke access on logout or detected refresh-token reuse.
- Backend role checks and property scoping on authenticated workflows; no authentication tokens in localStorage.
- Exact Origin checks and JSON-only state changes prevent cross-origin CSRF; no permissive CORS headers.
- Bounded JSON bodies, Zod validation, Prisma parameterized queries, structured error codes and request IDs.
- Database-backed authentication rate limits shared across app instances; per-identifier limits plus an app-wide abuse ceiling.
- AES-256-GCM encrypted phone contact values, HMAC phone lookup values, private encrypted S3 objects.
- CSP, HSTS, frame denial, MIME-sniffing protection, and restricted browser permissions. Next's inline bootstrap scripts require the current `unsafe-inline` script policy; evaluate a nonce-based CSP for the intended deployment.
- Pino logging omits submitted request payloads, credentials and personal data.

For a public release, review threat-model and operational needs: managed secret storage, backup/restore, database connection pooling, mail ownership verification if required, alerting, expiry/retention jobs, and provider monitoring. This codebase and its passing local tests are not a substitute for a deployment security review.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# With npm run dev running:
npm run test:integration
node tests/database-integration.mjs
node tests/otp-integration.mjs
npm run test:browser
```

The database integration suite creates accounts/properties prefixed with `QA` in the configured database. Run it against a local/test database only. It tests real email authentication, onboarding, current-month rent generation, rent updates, complaint resolution, property isolation, refresh rotation/replay revocation, and logout.

The OTP suite inserts controlled test challenges into the local database to verify expiry, attempt limits, one-time use and encrypted contact storage. It does not call the SMS provider or add a development bypass to the application.

The browser suite uses installed Microsoft Edge in headless mode, with a project-local profile. It tests owner and tenant demos, tenant search/details, announcement publication, menu editing, 390px mobile layout, account navigation, and complaint submission. Screenshots are stored under `.data/qa`.

## Production build

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
```

Use a supported Node.js release (Node 22.12+ or Node 24), PostgreSQL, HTTPS termination, and the configured production origin/secrets. `npm start` binds to localhost for local production testing; Vercel manages the production runtime. Never seed real production tenants with sample data. Deploy migrations as an explicit release step.

The live application is **https://pgconnect-one.vercel.app**, hosted on Vercel Hobby with Neon Free PostgreSQL. See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment settings, verification, and future releases. Production supports email/password sign-in; SMS and S3 integrations require separate configuration. Online rent checkout uses each owner's Razorpay account: see [PAYMENTS.md](PAYMENTS.md) and connect the account under Settings → Payments.
