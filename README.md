This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Backups

Supabase's Free plan takes **no automatic backups** — their own docs tell free
projects to export their data themselves and keep it off-site. Nothing else is
copying this data, so this is the only copy there is.

**Once a week:**

```bash
npm run backup
```

That writes `backups/<date>_<time>/` — every table as JSON, every order photo as
its original file, and a `manifest.json` recording what was taken. It reads the
credentials already in `.env.local`; there is nothing else to set up.

**Then copy that folder off this machine** — Google Drive, a pen drive, anywhere
that is not this laptop. A backup stored beside the thing it is backing up only
survives the failures that were never going to hurt you.

### Restoring

```bash
npm run restore -- backups/2026-09-02_2121            # dry run: says what it would do
npm run restore -- backups/2026-09-02_2121 --confirm  # actually writes
```

Rows are upserted by id and photos are uploaded with upsert, so a restore puts
the copy back over anything sharing an id. It does **not** delete rows created
after the backup was taken — this restores a copy, it does not rewind the
project. Afterwards it prints two `setval(...)` statements to run in the
Supabase SQL editor; those put the order-id sequences (`B2530`, `S2208`, …) back
where they were, and skipping them would hand the next customer an id that is
already taken.

### Never commit a backup

`backups/` is gitignored, and it must stay that way. **This repository is
public**, and a dump holds every customer's name, phone number, measurements and
payment history.

### What a backup does not cover

Deleting the Supabase project removes everything, including anything Supabase
holds for you — which is why the off-site copy matters. A free project also
pauses after 7 days of inactivity and is only restorable for 90 days after that;
the daily `/api/health` cron in `vercel.json` is what keeps it awake, so leave it
alone.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
