-- =============================================================================
-- HerbHub core schema
--
-- An herbal practice manager with three kinds of account:
--   owner   - the practitioner; full access (there can be more than one).
--   helper  - staff who carry out jobs the owner assigns them.
--   patient - a person receiving care who uses the patient app.
--
-- Design notes
--   * A `patient` row exists for everyone under care. It MAY be linked to a
--     `profile` (an account) when that patient uses the app on their phone.
--   * Catalog items are `remedies` (something prepared/given) or `services`
--     (done on the patient's behalf). The owner names their own categories;
--     the app never hard-codes category meanings.
--   * A catalog item's PRIVATE content (ingredients / procedure) lives in a
--     separate table, `catalog_item_secrets`, protected by row-level security
--     so an untrusted device is never even sent it. It is revealed to a helper
--     only when (a) the owner trusts them with that item AND (b) they are the
--     assignee of a job for it AND (c) that job is paid.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.app_role        as enum ('owner', 'helper', 'patient');
create type public.account_status  as enum ('pending', 'active', 'suspended');
create type public.gender          as enum ('male', 'female', 'other', 'unknown');
create type public.item_kind       as enum ('remedy', 'service');
create type public.job_status      as enum ('pending', 'started', 'in_progress', 'done', 'cancelled');
create type public.job_source      as enum ('owner', 'patient');       -- who initiated it
create type public.appt_status     as enum ('scheduled', 'completed', 'cancelled');
create type public.pay_kind        as enum ('plan', 'consultation', 'appointment', 'order', 'other');
create type public.pay_method      as enum ('transfer', 'gateway', 'cash');
create type public.pay_status      as enum ('pending', 'confirmed', 'failed', 'refunded');
create type public.msg_kind        as enum ('text', 'voice', 'image', 'file', 'system');
create type public.convo_status    as enum ('open', 'closed');

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  display_name   text not null default '',
  phone          text,
  email          text,
  role           public.app_role not null default 'patient',
  status         public.account_status not null default 'pending',
  -- Owner marks a helper as generally trusted. Even a trusted helper only sees
  -- a secret when assigned a paid job for that item (see can_view_secret()).
  is_trusted     boolean not null default false,
  locale         text not null default 'en' check (locale in ('en','ha','ar')),
  avatar_path    text,
  created_at     timestamptz not null default now()
);

-- Practice-wide settings (single row).
create table public.app_settings (
  id                        boolean primary key default true check (id),
  clinic_name               text not null default 'HerbHub',
  currency                  text not null default 'NGN',
  -- Consultation gate: patient pays this before a new chat opens (0 or disabled = free).
  consultation_fee_enabled  boolean not null default false,
  consultation_fee          numeric(12,2) not null default 0 check (consultation_fee >= 0),
  -- Appointments: default fee (0 = free); any single appointment may override.
  appointment_fee_enabled   boolean not null default false,
  appointment_fee_default   numeric(12,2) not null default 0 check (appointment_fee_default >= 0),
  -- Manual bank transfer details shown to patients.
  bank_name                 text,
  bank_account_no           text,
  bank_account_name         text,
  gateway                   text check (gateway in ('paystack','flutterwave')),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users on delete set null
);
insert into public.app_settings default values;

-- -----------------------------------------------------------------------------
-- Patients
-- -----------------------------------------------------------------------------
create table public.patients (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique references public.profiles on delete set null, -- set when they have an app account
  full_name     text not null check (length(btrim(full_name)) > 0),
  phone         text,
  email         text,
  gender        public.gender not null default 'unknown',
  birth_date    date,
  age_years     smallint check (age_years is null or age_years between 0 and 150),
  address       text,
  notes         text,                      -- medical history / observations (staff only)
  created_by    uuid default auth.uid() references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index patients_name_idx on public.patients (lower(full_name));
create index patients_profile_idx on public.patients (profile_id);

-- -----------------------------------------------------------------------------
-- Catalog: owner-defined categories, then remedies & services
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  kind        public.item_kind not null,
  name        text not null check (length(btrim(name)) > 0),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (kind, name)
);

create table public.catalog_items (
  id                  uuid primary key default gen_random_uuid(),
  kind                public.item_kind not null,
  category_id         uuid references public.categories on delete set null,
  name                text not null check (length(btrim(name)) > 0),
  public_description  text,                               -- what patients see
  price               numeric(12,2) not null default 0 check (price >= 0),
  cost                numeric(12,2) not null default 0 check (cost >= 0),   -- owner's cost
  has_secret          boolean not null default false,     -- true => private details exist
  is_published        boolean not null default false,     -- visible to patients in catalog
  image_path          text,
  created_by          uuid default auth.uid() references auth.users on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index catalog_items_kind_idx on public.catalog_items (kind, is_published);
create index catalog_items_category_idx on public.catalog_items (category_id);

-- The PRIVATE content of an item, kept in its own row so RLS can hide it.
create table public.catalog_item_secrets (
  item_id     uuid primary key references public.catalog_items on delete cascade,
  details     text,                       -- ingredients, procedure, prayers, etc.
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users on delete set null
);

-- Which helpers the owner trusts with a given item's secret.
create table public.item_trusted_helpers (
  item_id     uuid not null references public.catalog_items on delete cascade,
  helper_id   uuid not null references public.profiles on delete cascade,
  granted_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  primary key (item_id, helper_id)
);

-- -----------------------------------------------------------------------------
-- Jobs: the remedies/services chosen for a patient (their treatment plan).
-- Each job is one line the patient can follow and a helper can be assigned to.
-- -----------------------------------------------------------------------------
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients on delete cascade,
  item_id       uuid references public.catalog_items on delete set null,  -- null for a custom one-off
  kind          public.item_kind not null default 'remedy',
  name          text not null,              -- snapshot of the item name
  quantity      numeric(10,2) not null default 1 check (quantity > 0),
  unit_price    numeric(12,2) not null default 0 check (unit_price >= 0),
  unit_cost     numeric(12,2) not null default 0 check (unit_cost >= 0),
  is_charity    boolean not null default false,   -- done free; counted in charity metrics
  status        public.job_status not null default 'pending',
  source        public.job_source not null default 'owner',
  assignee_id   uuid references public.profiles on delete set null,  -- the helper (or owner)
  is_paid       boolean not null default false,   -- set when the related payment confirms
  notes         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_by    uuid default auth.uid() references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index jobs_patient_idx on public.jobs (patient_id);
create index jobs_assignee_idx on public.jobs (assignee_id);
create index jobs_item_idx on public.jobs (item_id);

-- Optional checklist steps inside a job (shown to the helper on the job detail).
create table public.job_steps (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs on delete cascade,
  label       text not null,
  is_done     boolean not null default false,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);
create index job_steps_job_idx on public.job_steps (job_id);

-- -----------------------------------------------------------------------------
-- Appointments (each free or paid)
-- -----------------------------------------------------------------------------
create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients on delete cascade,
  scheduled_at  timestamptz not null,
  duration_min  smallint not null default 30,
  reason        text,
  status        public.appt_status not null default 'scheduled',
  fee           numeric(12,2) not null default 0 check (fee >= 0),  -- 0 = free
  is_paid       boolean not null default false,
  created_by    uuid default auth.uid() references auth.users on delete set null,
  created_at    timestamptz not null default now()
);
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_when_idx on public.appointments (scheduled_at);

-- -----------------------------------------------------------------------------
-- Payments (manual transfer + gateway)
-- -----------------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  kind            public.pay_kind not null default 'plan',
  method          public.pay_method not null default 'transfer',
  status          public.pay_status not null default 'pending',
  reference       text,                      -- gateway reference
  proof_path      text,                      -- uploaded transfer proof (manual)
  job_id          uuid references public.jobs on delete set null,
  appointment_id  uuid references public.appointments on delete set null,
  conversation_id uuid,                       -- FK added after conversations exists
  note            text,
  created_by      uuid default auth.uid() references auth.users on delete set null,
  confirmed_by    uuid references auth.users on delete set null,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index payments_patient_idx on public.payments (patient_id);
create index payments_status_idx on public.payments (status, created_at);

-- -----------------------------------------------------------------------------
-- Chat: a conversation per patient, routed owner -> (transfer) -> helper
-- -----------------------------------------------------------------------------
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients on delete cascade,
  assignee_id           uuid references public.profiles on delete set null,  -- owner by default; owner may transfer to a helper
  status                public.convo_status not null default 'open',
  -- Consultation gate: when required, the patient cannot send until paid.
  consultation_required boolean not null default false,
  consultation_paid     boolean not null default false,
  last_message_at       timestamptz,
  created_at            timestamptz not null default now()
);
create index conversations_patient_idx on public.conversations (patient_id);
create index conversations_assignee_idx on public.conversations (assignee_id);

alter table public.payments
  add constraint payments_conversation_fk
  foreign key (conversation_id) references public.conversations on delete set null;

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations on delete cascade,
  sender_id        uuid references public.profiles on delete set null,  -- null for system messages
  kind             public.msg_kind not null default 'text',
  body             text,
  media_path       text,                      -- voice note / image / file in storage
  duration_sec     smallint,                  -- voice note length
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);
create index messages_convo_idx on public.messages (conversation_id, created_at);

-- =============================================================================
-- Helper functions (security definer; used by RLS)
-- =============================================================================
create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'owner');
$$;

create function public.is_staff() returns boolean   -- owner or helper
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and status = 'active' and role in ('owner','helper'));
$$;

-- The patient row that belongs to the signed-in account (if any).
create function public.my_patient_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.patients where profile_id = auth.uid();
$$;

-- Can the signed-in user carry out work for this patient?
-- Owner: always. Helper: if assigned any job or the patient's conversation.
create function public.can_work_patient(p_patient uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_owner()
      or exists (select 1 from public.jobs j
                 where j.patient_id = p_patient and j.assignee_id = auth.uid())
      or exists (select 1 from public.conversations c
                 where c.patient_id = p_patient and c.assignee_id = auth.uid());
$$;

-- The core secrecy rule: may the signed-in user see this item's private details?
--   owner  -> yes
--   helper -> only if trusted for the item AND assigned a PAID job for it
create function public.can_view_secret(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_owner()
      or (
        exists (select 1 from public.item_trusted_helpers t
                where t.item_id = p_item and t.helper_id = auth.uid())
        and exists (select 1 from public.jobs j
                    where j.item_id = p_item and j.assignee_id = auth.uid() and j.is_paid)
      );
$$;

-- =============================================================================
-- Triggers
-- =============================================================================
create function public.touch_updated() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger patients_touch       before update on public.patients       for each row execute function public.touch_updated();
create trigger catalog_items_touch  before update on public.catalog_items  for each row execute function public.touch_updated();
create trigger jobs_touch           before update on public.jobs           for each row execute function public.touch_updated();

-- Create a profile automatically when a new auth user signs up.
-- The very first account becomes the owner; everyone else starts as a pending patient.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, display_name, email, phone, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    new.email,
    new.phone,
    (case when first_user then 'owner' else 'patient' end)::public.app_role,
    (case when first_user then 'active' else 'pending' end)::public.account_status
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Keep a conversation's last_message_at fresh.
create function public.bump_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end; $$;
create trigger messages_bump after insert on public.messages for each row execute function public.bump_conversation();

-- =============================================================================
-- Row-level security
-- =============================================================================
alter table public.profiles             enable row level security;
alter table public.app_settings          enable row level security;
alter table public.patients              enable row level security;
alter table public.categories            enable row level security;
alter table public.catalog_items         enable row level security;
alter table public.catalog_item_secrets  enable row level security;
alter table public.item_trusted_helpers  enable row level security;
alter table public.jobs                  enable row level security;
alter table public.job_steps             enable row level security;
alter table public.appointments          enable row level security;
alter table public.payments              enable row level security;
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;

-- profiles: you see yourself; staff see everyone; owner manages.
create policy profiles_self   on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_owner  on public.profiles for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- app_settings: everyone signed in can read (patients need bank details & fees); owner writes.
create policy settings_read  on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- patients: staff who can work them, or the patient themselves.
create policy patients_read   on public.patients for select to authenticated
  using (public.is_owner() or public.can_work_patient(id) or profile_id = auth.uid());
create policy patients_write  on public.patients for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy patients_update_self on public.patients for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- categories: staff read; owner writes.
create policy categories_read  on public.categories for select to authenticated using (public.is_staff() or true);
create policy categories_write on public.categories for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- catalog items: published items are readable by anyone signed in; staff see all; owner writes.
create policy items_read  on public.catalog_items for select to authenticated using (is_published or public.is_staff());
create policy items_write on public.catalog_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- SECRETS: only when can_view_secret() allows. Owner writes.
create policy secrets_read  on public.catalog_item_secrets for select to authenticated using (public.can_view_secret(item_id));
create policy secrets_write on public.catalog_item_secrets for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- trusted-helper list: staff read; owner writes.
create policy trust_read  on public.item_trusted_helpers for select to authenticated using (public.is_staff());
create policy trust_write on public.item_trusted_helpers for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- jobs: owner all; helper their assigned; patient read-only their own (status/progress).
create policy jobs_read   on public.jobs for select to authenticated
  using (public.is_owner() or assignee_id = auth.uid() or patient_id = public.my_patient_id());
create policy jobs_owner  on public.jobs for all to authenticated using (public.is_owner()) with check (public.is_owner());
-- a helper may update the status/steps of a job assigned to them
create policy jobs_helper_update on public.jobs for update to authenticated
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());

-- job steps: same visibility as the parent job.
create policy steps_read on public.job_steps for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id
          and (public.is_owner() or j.assignee_id = auth.uid() or j.patient_id = public.my_patient_id())));
create policy steps_write on public.job_steps for all to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and (public.is_owner() or j.assignee_id = auth.uid())))
  with check (
  exists (select 1 from public.jobs j where j.id = job_id and (public.is_owner() or j.assignee_id = auth.uid())));

-- appointments: owner all; staff for patients they work; patient own (+ may request).
create policy appts_read   on public.appointments for select to authenticated
  using (public.is_owner() or public.can_work_patient(patient_id) or patient_id = public.my_patient_id());
create policy appts_owner  on public.appointments for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy appts_patient_insert on public.appointments for insert to authenticated
  with check (patient_id = public.my_patient_id());

-- payments: owner all; patient own (+ may record a transfer with proof).
create policy pay_read   on public.payments for select to authenticated
  using (public.is_owner() or patient_id = public.my_patient_id());
create policy pay_owner  on public.payments for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy pay_patient_insert on public.payments for insert to authenticated
  with check (patient_id = public.my_patient_id() and status = 'pending');

-- conversations: owner all; assignee; the patient who owns it.
create policy convo_read   on public.conversations for select to authenticated
  using (public.is_owner() or assignee_id = auth.uid() or patient_id = public.my_patient_id());
create policy convo_owner  on public.conversations for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy convo_assignee_update on public.conversations for update to authenticated
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());
create policy convo_patient_insert on public.conversations for insert to authenticated
  with check (patient_id = public.my_patient_id());

-- messages: any participant of the conversation may read; participants may send.
create policy msg_read on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id
          and (public.is_owner() or c.assignee_id = auth.uid() or c.patient_id = public.my_patient_id())));
create policy msg_send on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id
          and (public.is_owner() or c.assignee_id = auth.uid() or c.patient_id = public.my_patient_id())));

-- =============================================================================
-- Grants (RLS still applies on top of these)
-- =============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
