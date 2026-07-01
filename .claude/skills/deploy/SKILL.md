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

- No environment variables are required currently (no backend, all client-side mock data).
- When a real backend is added, set env vars in the Vercel dashboard under Project → Settings → Environment Variables, prefixed with `NEXT_PUBLIC_` for client-side vars.
- The `npm run start` command runs the production server locally on port 3000 — useful for testing the production build before pushing.
