# HerbHub data model

The backend is **Supabase (PostgreSQL)**. Access is enforced by **row-level
security (RLS)** — the rules below are applied by the database itself, so a
device is never sent data its user isn't allowed to see. Migrations live in
`supabase/migrations/`.

## Accounts and roles

Everyone signs in through Supabase Auth; each account has a `profiles` row with a
**role**:

| Role | Who | Can see / do |
|------|-----|--------------|
| `owner` | you (the practitioner) | everything |
| `helper` | staff | patients, jobs and chats **assigned to them** |
| `patient` | people under care with the app | **their own** records only |

The **first account to sign up becomes the owner** automatically; everyone else
starts as a pending patient the owner can activate.

## The private-recipe rule (enforced in the database)

A catalog item's public information (name, description, price) lives in
`catalog_items`. Its **secret** (ingredients, procedure) lives in a separate
table, `catalog_item_secrets`, with this rule:

> A helper may read a secret **only if** the owner has marked them *trusted for
> that item* **and** they are the assignee of a **paid** job for it.

The owner always sees it; patients never do. Because this is an RLS policy, an
untrusted helper's app is never even sent the secret — it isn't just hidden on
screen.

## Main tables

- **patients** — everyone under care. Linked to a `profile` when they use the app.
- **categories** — owner-defined, per kind (`remedy` / `service`). You name them.
- **catalog_items** — remedies and services: public info, price, cost, published flag.
- **catalog_item_secrets** — the private details, protected as above.
- **item_trusted_helpers** — which helpers are trusted with which item's secret.
- **jobs** — the remedies/services chosen for a patient (their treatment plan).
  Each has a status (`pending → started → in_progress → done`), an optional
  assignee (helper), a `is_charity` flag, and `is_paid`. Patients can see the
  status and progress, never the secret.
- **job_steps** — optional checklist inside a job (shown to the assigned helper).
- **appointments** — each with its own `fee` (0 = free) and `is_paid`.
- **payments** — manual bank **transfer** (with uploaded proof, confirmed by the
  owner) or **gateway** (Paystack / Flutterwave, auto-confirmed). Linked to a
  job, appointment, or consultation.
- **conversations** / **messages** — chat. A conversation starts assigned to the
  **owner**; the owner can **transfer** it to a helper, who can then add remedies.
  A conversation can require a **consultation fee** before the patient can send.
- **app_settings** — one row: clinic name, currency, consultation-fee toggle and
  amount, default appointment fee, bank-transfer details, chosen gateway.

## Charity and metrics

Any job or service can be marked **charity** (`is_charity = true`) — done free.
Insights/analytics sum these for "charity given" alongside income, profit, top
items and outstanding balances (computed from `payments` and `jobs`).

## Storage buckets

`avatars` and `catalog` (public images), `chat` (voice notes / images / files,
readable only by the conversation's participants), and `proofs` (bank-transfer
proof, owner + that patient only). See `supabase/migrations/*_storage.sql`.
