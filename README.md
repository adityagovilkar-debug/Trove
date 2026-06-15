# 🥫 Trove — Home Inventory

Know what you own, what's expiring, and what to rebuy — before you buy it again.

Trove is an installable **PWA** (works as a desktop app *and* a website) backed
by **Supabase**. It's household-shared (you + family share one inventory) and
**domain-extensible**: groceries today, electronics/books/anything tomorrow
without a schema rewrite.

## Features

- **"Do I have it?" search** — type a name, instantly see if it's already in the
  house and where, before you rebuy.
- **Add stock** with item, type, expiry, quantity+unit, price, purchase date,
  location, store, and notes — plus **webcam barcode scanning** that auto-fills
  details from Open Food Facts.
- **Expiring soon** dashboard + color-coded badges (expired / ≤3d / ≤7d).
- **Mark finished** — items move to history (kept for trends), not deleted.
- **Trends** — rebuy frequency ("how often do I buy rice?"), spend over time,
  and used-vs-wasted analysis.
- **Daily expiry email digest** (optional Edge Function + cron).
- **Households** — share one inventory via a join code.
- **Installable** to your taskbar/dock/home screen; light & dark themes.

---

## Setup (≈10 minutes)

### 1. Create a Supabase project
- Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
- Once it's ready, open **Project Settings → API** and copy:
  - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Configure env
```bash
cp .env.local.example .env.local
```
Paste your URL and anon key into `.env.local` (it overwrites the placeholder
values shipped for the build check).

### 3. Create the database
- In Supabase, open **SQL Editor → New query**.
- Paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
  and **Run**. This creates every table, the row-level-security policies, and a
  trigger that seeds a fresh household (default locations + grocery categories)
  the first time you sign up.

### 4. Auth settings
- **Authentication → Providers → Email**: make sure Email is enabled.
- For instant local testing you can turn **"Confirm email" off**
  (Authentication → Sign In / Providers). With it on, you'll get a confirmation
  link that returns to `/auth/callback`.
- **Authentication → URL Configuration**: add your site URL
  (`http://localhost:3010` for dev, and your Vercel URL for prod) to the
  redirect allow-list.

### 5. Run it
```bash
npm install
npm run dev      # http://localhost:3010
```
Create an account → you land in a ready-to-use home with seeded locations and
categories. Click the install icon in your browser's address bar to add Trove
to your desktop.

---

## Deploy to Vercel

1. Push this folder to a Git repo and **Import** it at
   [vercel.com/new](https://vercel.com/new).
2. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables in the Vercel
   project settings.
3. Deploy. Add the resulting URL to Supabase's redirect allow-list (step 4).

---

## Optional: daily expiry email

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link the
   project: `supabase link --project-ref <ref>`.
2. Get a [Resend](https://resend.com) API key (free) and a verified sender.
3. Set secrets and deploy the function:
   ```bash
   supabase secrets set RESEND_API_KEY=... EXPIRY_EMAIL_FROM="Trove <larder@yourdomain.com>"
   supabase functions deploy expiry-digest --no-verify-jwt
   ```
4. Schedule it: edit [`supabase/migrations/0002_cron.sql`](supabase/migrations/0002_cron.sql)
   (replace `<PROJECT_REF>`) and run it in the SQL Editor.

---

## Architecture

| Layer | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + React 19, TypeScript, Turbopack |
| Styling | Tailwind v4 |
| Data | Supabase (Postgres + Auth + RLS) queried client-side via TanStack Query |
| Auth | `@supabase/ssr`; session refreshed in `proxy.ts` (Next 16's renamed middleware) |
| Charts | Recharts · **Barcode** ZXing + Open Food Facts |
| PWA | `app/manifest.ts` + `public/sw.js` |

### Why it's extensible
`items` is the *catalog concept* of a thing and carries a `domain` plus a JSONB
`attributes` bag. `inventory` rows are physical stock; marking them
finished/expired keeps the row as history (that's what powers trends). Adding a
new kind of thing (electronics with serial/warranty, books with author/ISBN and
a classification system) is just a new domain + attribute fields — **no core
table migration**. See comments in `supabase/migrations/0001_init.sql`.

### Project layout
```
app/
  (app)/            authenticated pages (dashboard, inventory, add, trends, settings)
  login/            auth screen
  auth/callback/    email-confirm handler
components/         AppShell, StockCard, CheckHaveSearch, BarcodeScanner, ...
lib/
  queries.ts        TanStack Query hooks (reads + mutations)
  supabase/         browser + server + proxy clients
  types.ts utils.ts barcode.ts
supabase/
  migrations/       schema + RLS (0001) and cron (0002)
  functions/        expiry-digest Edge Function
proxy.ts            session refresh + route guard
```

## Roadmap (iteration 2)
- Electronics & Books domains with type-specific fields + book classification.
- Auto shopping list from finished/low items.
- Real PNG/maskable icons, photo uploads to Supabase Storage.
