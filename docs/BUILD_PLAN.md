# HerbHub build plan

HerbHub is being built the same way as **BuaFamily**: a **Flutter** app
(Material 3, the approved green/gold design) on a **Supabase** backend, with
**Riverpod** state and **go_router** navigation. It serves three roles from one
codebase — owner, helper, patient.

Approved design (clickable): https://claude.ai/artifact/PfMaVdWp2KggoxhTD55kNi

## Repository layout

```
app/                 Flutter app
  lib/ui/theme.dart  the approved design system (in code)
  lib/main.dart      app bootstrap
supabase/
  migrations/        database schema + row-level security (validated)
  seed.sql           starter catalog categories
docs/                this plan + the data model
```

## Phases

- [x] **0 — Foundation** (this step): database schema + RLS (validated), storage
  buckets, Flutter project scaffold, design system in code.
- [ ] **1 — Accounts & core**: sign-in, owner activates helpers/patients,
  patients CRUD, catalog (remedies/services + your own categories), private
  recipes with the trust rule.
- [ ] **2 — Treatment & jobs**: build a patient's plan, assign helpers, job
  status + checklist, patient sees progress, charity flag.
- [ ] **3 — Chat**: patient → owner routing, transfer to helper, helper adds
  remedies; text + voice notes + images (WhatsApp-style).
- [ ] **4 — Payments & fees**: manual transfer (proof + confirm), consultation
  fee gate, per-appointment fees, Paystack/Flutterwave gateway.
- [ ] **5 — Insights**: income, profit, outstanding, charity given, top items.
- [ ] **6 — Polish**: English / Hausa / Arabic (RTL), notifications, release.

## What will be needed from you (flagged when we reach each)

1. **A Supabase project** — free to start. The schema here applies to it with
   one command. (This can be created for you once you say go.)
2. **Payment keys** — Paystack and/or Flutterwave API keys (Phase 4).
3. **Your bank details** — for the manual-transfer option (entered in Settings).
4. **Distribution** — a Flutter **web** build can go online quickly (open on any
   phone browser); native **Android/iOS** builds for the app stores come later
   and need developer accounts.

## Running it (once Supabase is set up)

```bash
cd app
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
```

Applying the database schema (with the Supabase CLI):

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```
