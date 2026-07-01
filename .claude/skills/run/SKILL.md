---
description: Launch the Sara Designer Studio dev server and verify it is running
---

# Run — Sara Designer Studio

## Prerequisites

Needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` in `.env.local` (Phase 2 — real Supabase backend, no more mock data). Without these, every page that calls `requireRole()`/`getDb()` will throw at request time.

## Start the dev server

```bash
npm run dev > /tmp/nextjs-dev.log 2>&1 &
echo "PID: $!"
```

Wait for ready signal (usually under 5 seconds):

```bash
sleep 5 && cat /tmp/nextjs-dev.log
```

Expected output contains:
```
▲ Next.js 16.2.9 (Turbopack)
- Local: http://localhost:3000
- Environments: .env.local
✓ Ready in ...ms
```

If a stale server is already running on port 3000 without the current `.env.local` loaded (e.g. started before env vars were added), kill it and restart rather than letting Next.js fall back to another port — check the log line `- Environments: .env.local` to confirm it picked up the file.

## Smoke test

Unauthenticated requests to protected routes now redirect (307) to `/login` via `src/proxy.ts` — this is correct, not a bug:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login && echo " /login (expect 200)"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/orders && echo " /admin/orders (expect 307 when logged out)"
```

## Testing the real login flow via curl

`/login` is a Server Action form (`useActionState`), not a plain POST endpoint — you can't just `curl -d "username=x&password=y"`. For progressive-enhancement forms, Next.js renders the action as `multipart/form-data` with hidden `$ACTION_*` fields that must be replayed verbatim. Fetch the page first to read the current action id/key (they're per-render and change on every request):

```bash
curl -s http://localhost:3000/login -o /tmp/login_page.html
grep -o '<input[^>]*type="hidden"[^>]*>' /tmp/login_page.html
```

Then POST with those exact field values plus credentials:

```bash
curl -s -c /tmp/cookies.txt -D - -o /dev/null \
  -X POST "http://localhost:3000/login" \
  -F '$ACTION_REF_1=' \
  -F '$ACTION_1:0={"id":"<id-from-page>","bound":"$@1"}' \
  -F '$ACTION_1:1=[{}]' \
  -F '$ACTION_KEY=<key-from-page>' \
  -F 'username=<username>' \
  -F 'password=<password>'
```

A successful login returns `303` with `Location: /admin` (or the matching role queue) and sets the `sds_session` httpOnly cookie. Reuse `-b /tmp/cookies.txt` on subsequent requests to hit authenticated routes.

## Notes

- App is mobile-first; test at 430 px width in browser DevTools.
- Real username/password login (`/login`), one form for all roles — role is looked up from the account after auth, not chosen up front.
- Orders and staff now live in Supabase Postgres (`src/lib/db/`), not `src/lib/mock.ts` (which only holds static reference data like dress types/fabrics now).
- No signup flow — new staff accounts are created by an admin via `/admin/staff/new`. The very first admin account must be seeded manually (see `supabase/seed.sql`).
