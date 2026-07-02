---
description: Build and deploy Sara Designer Studio to production (Vercel recommended)
---

# Deploy — Sara Designer Studio

## 1. Production build (local verification)

Always run a production build before deploying to catch type errors and build failures:

```bash
npm run build
```

Expected: exits 0 with `✓ Compiled successfully`. Fix any errors before proceeding.

## 2. Deploy to Vercel (recommended)

Sara Designer Studio is a Next.js PWA — Vercel is the zero-config target.

### First-time setup

```bash
npx vercel login          # authenticate with your Vercel account
npx vercel link           # link this directory to a Vercel project
```

### Deploy to preview

```bash
npx vercel
```

### Deploy to production

**Get explicit user approval before running this** — each round of changes needs its own go-ahead, even mid-task. Finish and verify the build first, then ask "ready to deploy?" and wait for a clear yes.

```bash
npx vercel --prod
```

Vercel will output a URL (e.g. `https://sara-designer-studio.vercel.app`).

## 3. PWA checklist before deploying

- [ ] `public/manifest.json` has correct `start_url`, `name`, and icons
- [ ] `public/sw.js` service worker is present
- [ ] `public/icon-192.png` and `public/icon-512.png` exist
- [ ] HTTPS is served (required for service workers — Vercel does this automatically)

## 4. Verify the deployed PWA

After deploying, open the URL in Chrome DevTools → Application → Service Workers to confirm the SW registered. Also test "Add to Home Screen" on a mobile device.

## Notes

- Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` — already set on all three Vercel environments (production/preview/development) via `vercel env add`. These are server-only secrets (used only in Server Actions/Server Components) and must **not** get a `NEXT_PUBLIC_` prefix — that would ship the service-role key to the browser.
- Orders and staff live in Supabase Postgres (`src/lib/db/`); `src/lib/mock.ts` only holds static reference data now.
- The `npm run start` command runs the production server locally on port 3000 — useful for testing the production build before pushing.
