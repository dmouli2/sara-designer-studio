# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev            # Turbopack dev server (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET in .env.local)
npm run build           # production build
npm run start            # serve the production build
npm run lint              # eslint
npm test                   # vitest run (single run, CI mode)
npm run test:watch          # vitest watch mode
npm run test:coverage        # vitest run --coverage (must stay >= 90% lines/statements/branches/functions)
npx vitest run src/lib/dal.test.ts   # single test file
npx vitest run -t "test name"        # single test by name
```

There is no signup flow — the first admin account is seeded manually via `supabase/seed.sql` using a bcrypt hash from `node scripts/hash-password.mjs "<password>"`.

## Architecture

**This is a modified Next.js (16.2.9) with renamed/added APIs — do not assume upstream Next.js behavior.** Before using an unfamiliar API, check `node_modules/next/dist/docs/`. Two deviations already in use in this repo:
- `middleware.ts` is renamed to `proxy.ts` / `export function proxy(...)` (`src/proxy.ts`).
- `next/cache` exports a `refresh()` function (in addition to `revalidatePath`), used alongside `revalidatePath` after mutations that affect client-cached data (see `src/app/actions/orders.ts`).

**Backend is ports-and-adapters, not direct Supabase calls from routes/components.** Dependency rule: only depend downward (domain types → repository ports → adapters), never sideways into a vendor SDK.
- `src/lib/db/types.ts` defines the `Database`/`StaffRepository`/`OrderRepository` port interfaces. `src/lib/db/index.ts` exposes a `getDb()` singleton that wires in the Supabase adapters under `src/lib/db/supabase/`. Same pattern for images: `src/lib/storage/types.ts` (`ImageStorage` port) + `src/lib/storage/index.ts` (`getImageStorage()`) + `src/lib/storage/supabase/imageStorage.ts`.
- `@supabase/supabase-js` may only be imported inside `src/lib/db/supabase/`, `src/lib/storage/supabase/`, and the shared client factory `src/lib/supabase/client.ts` that both adapters use — never from a route, component, or Server Action directly.
- Tests reset these singletons with `resetDbForTests()` / `resetImageStorageForTests()` rather than re-mocking modules.
- `src/lib/mock.ts` no longer holds orders/staff — it's static reference data only (dress types, fabric price list, line-item presets). Real orders/staff live in Supabase Postgres (migrations in `supabase/migrations/`).
- Order images are **not** stored as base64 in Postgres (that blew through the DB quota fast). `orders.sketch_data_url`/`reference_image_url` hold Storage paths; `orderRepository.ts`'s `findById`/`create`/`update` resolve those to fresh signed URLs on every read, while `list()` deliberately omits the image columns and always returns them `null` (list views never render images — avoids pulling image payloads on every list load).

**Auth has two layers, and only one of them is real.**
- `src/lib/session.ts` signs/verifies a JWT (via `jose`) stored in the httpOnly `sds_session` cookie.
- `src/proxy.ts` only decrypts the cookie for a fast, optimistic redirect — it never hits the database.
- `src/lib/dal.ts` (`verifySession()` / `requireRole(roles)`) does the real authorization: it re-fetches the staff record from `getDb()` on every call and redirects if the account is missing/inactive or lacks the role. Every Server Action must call `requireRole(...)` itself — proxy-level auth is not sufficient.

**Server Actions are the only DB access point for UI code.** `src/app/actions/{auth,orders,staff}.ts` are `"use server"` modules: each exported action calls `requireRole()` first, then `getDb()`. Mutations end with `revalidatePath(...)` (and sometimes `refresh()`) for every route that displays the changed data — see `revalidateOrderPaths()` in `orders.ts` for the pattern.

**Roles and routing:** `Role = "admin" | "master" | "tailor"`. Admin works under `/admin` (orders list/detail/new, staff list/detail/new). Master and tailor each get `/{role}/queue` and `/{role}/orders/[id]`. `roleHome(role)` (duplicated in `src/proxy.ts` and `src/app/actions/auth.ts`) picks the post-login landing route.

**Order domain model** (`src/types/index.ts`): `Order.measurements` is a discriminated union (`GarmentMeasurements` = blouse | salwar | generic) picked by dress type — see the matching form components in `src/components/orders/`. `OrderStatus` is a fixed pipeline: `new → cutting → cutting_done → stitching → ready → delivered`. `sketchDataUrl` / `referenceImageUrl` are storage paths, not raw image data — the order wizard uploads a base64 `data:` URL client-side, and `storeImage()` in `src/app/actions/orders.ts` swaps it for a storage path before it reaches the `orders` table.

**Testing setup** (`vitest.setup.ts`) globally mocks `next/navigation`, `next/headers` (`cookies`), `next/cache`, `next/font/google`, and `next/image`. Reuse the exported `mockRouter`, `mockCookieStore`, `mockRevalidatePath`, `mockRefresh` rather than mocking these modules again in individual test files. Some `src/lib` tests (crypto/session code using `jose`) run under a `@vitest-environment node` file-level directive because `jose`'s webapi build breaks under jsdom's vm realm — follow that pattern for other server-only, DOM-free lib code.

**PWA:** `public/manifest.json` + `public/sw.js`, served via the route handler at `src/app/sw.js/route.ts`, plus `ServiceWorkerRegister`/`InstallBanner` components. The app is mobile-first — verify UI changes at ~430px width.
