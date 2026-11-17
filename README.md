# 🌿 HerbHub — Herbal Practice Manager

A simple, self-contained web app for an herbal practitioner to keep patient
records, maintain a catalog of remedies, record visits, and track income.

No installation, no server, no database setup. Just open `index.html` in a web
browser and start using it.

## Features

- **Dashboard** — total income, remedy costs, profit, and outstanding (unpaid)
  balances at a glance, plus recent visits and who owes you money.
- **Patients** — add/edit patients with contact details and medical notes, and
  see each patient's full visit history and balance.
- **Remedies** — a catalog where each remedy has a **cost** (what it costs you)
  and a **price** (what you charge). The margin is shown automatically.
- **Visits** — for a patient, pick the remedies they need, set quantities, record
  what they paid, and the app calculates the charge, cost, profit, and balance
  due. Supports custom one-off items (e.g. "Consultation").
- **Backup & Restore** — download all your data to a file and restore it later.
  Also lets you move data to another device.
- **Settings** — set your practice name and currency symbol.

## How your data is stored

⚠️ **Important:** HerbHub stores all data **in the browser on the device you use
it on** (via `localStorage`). That means:

- Your data stays private and never leaves your device.
- It is **not** automatically synced between devices or browsers.
- Clearing your browser data, or using a different browser/device, will show an
  empty app.

👉 **Back up regularly** using the **Backup** button and keep the file somewhere
safe. To move to a new device, open HerbHub there and use **Restore**.

If you later want multi-device access with automatic sync, this can be upgraded
to use a hosted database — ask and it can be set up.

## Running it

**Option A — open directly**
Double-click `index.html` (or open it from your browser's File → Open menu).

**Option B — serve locally**
```bash
# from the project folder
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
index.html            # app shell
assets/css/styles.css # styling
assets/js/store.js    # data layer (localStorage, calculations)
assets/js/app.js       # UI, views, visit builder
```

## Data model

- **Patient** — name, phone, email, age, gender, address, notes.
- **Remedy** — name, description, cost, price.
- **Visit** — belongs to a patient; has a date, a list of line items
  (remedy, quantity, unit price, unit cost), amount paid, and notes.
  Charge, cost, profit, and balance are derived from the line items.
