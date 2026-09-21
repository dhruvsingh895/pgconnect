# PGConnect deployment

Live application: **https://pgconnect-one.vercel.app**

Deployed on September 21, 2026 using Vercel **Hobby** and Neon **Free**. No paid upgrade was selected.

## Hosting

- Vercel project: `pgconnect` (`prj_IIwsedA83SWPDNLTMzrqLyZBAd9K`)
- Dashboard: https://vercel.com/2k22aiml2212190-7670s-projects/pgconnect
- Neon project: `PGConnect` (`square-voice-62961344`)
- Database: `pgconnect`, PostgreSQL 17, Singapore
- Vercel functions: Singapore (`sin1`); Node.js 22
- Initial deployment: `dpl_6a4QPNEHzCSY31Pi1Fs95Dd7YMnP`
- Rent payments release (September 22, 2026): `dpl_4B4GwmFmPRiyY5oveFbR9nJ5vx9w`

Production uses a fresh database. Local demo accounts and local data were not uploaded. Both Prisma migrations were applied before verification.

## Using the app

Open the live link and select **Create an account**. Owners create their PG during onboarding; tenants join with the owner's invite code. Email/password authentication is enabled. Phone sign-in requires SMS configuration, and document/photo uploads require S3 configuration. Demo sign-in is disabled in production.

## Configuration and future releases

`vercel.json` selects Next.js, generates Prisma Client during installation, and builds the application. `.vercelignore` excludes local environment files, data, authentication credentials, caches, and tests from uploads. Vercel stores `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` as encrypted production environment variables. Never put them in `NEXT_PUBLIC_*` variables or commit them.

The database URL uses Neon's connection pooler with a small per-instance connection limit and startup timeouts. Migrations use a direct connection. Keep the signing/encryption secrets stable between releases, especially `ENCRYPTION_KEY`, which protects existing stored phone values.

From this folder, deploy future updates with:

```powershell
npx vercel deploy --prod --global-config .data/vercel-auth
```

For schema changes, apply reviewed Prisma migrations to Neon before deploying the dependent code. Run migration commands with a securely supplied production `DATABASE_URL`; do not replace the local development `.env`. The deployment does not automatically run destructive seed or reset commands.

CLI credentials are stored in ignored `.data/vercel-auth` and `.data/neon-auth`, inside this project folder. Keep `.data` private. The deployment is uploaded directly from this folder; Git-based automatic deployments are not connected.

## Verification

- Production build, lint, type check, and 11 unit tests passed.
- Public HTTPS health endpoint returned 200 and verified Neon connectivity.
- Live email registration, secure session cookies, owner onboarding, dashboard, login, and logout passed.
- Temporary verification accounts/properties were removed afterward.
- Live login page and dark/light theme controls checked in the browser.

Free plans have usage limits. Monitor the Vercel and Neon dashboards before increasing traffic. No SMS provider or object-storage provider has been provisioned.

## Rent payments release

The Razorpay checkout integration is deployed and migration `202609210003_rent_payments` is applied. Each owner must connect their own merchant account in Settings → Payments and configure its webhook before taking payments. No Razorpay merchant credentials were supplied during development, and no real payment was taken. See [PAYMENTS.md](PAYMENTS.md) for setup and operating instructions. This release passed 14 unit tests, mocked-provider integration against local PostgreSQL, lint, type checking, and the production build.
