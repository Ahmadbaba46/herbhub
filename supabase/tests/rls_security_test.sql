-- RLS security tests for HerbHub. Run after the core schema migration.
-- Simulates owner / trusted-helper / untrusted-helper / patient and checks the
-- row-level-security rules, especially the private-recipe secrecy.

-- Four accounts (the trigger creates their profiles; first one becomes owner).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','owner@x'),
  ('22222222-2222-2222-2222-222222222222','helper1@x'),
  ('33333333-3333-3333-3333-333333333333','helper2@x'),
  ('44444444-4444-4444-4444-444444444444','patient@x');

update public.profiles set role='owner'::public.app_role,   status='active'::public.account_status                    where id='11111111-1111-1111-1111-111111111111';
update public.profiles set role='helper'::public.app_role, status='active'::public.account_status, is_trusted=true   where id='22222222-2222-2222-2222-222222222222';
update public.profiles set role='helper'::public.app_role, status='active'::public.account_status, is_trusted=false  where id='33333333-3333-3333-3333-333333333333';
update public.profiles set role='patient'::public.app_role, status='active'::public.account_status                    where id='44444444-4444-4444-4444-444444444444';

insert into public.patients (id, profile_id, full_name)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','44444444-4444-4444-4444-444444444444','Test Patient');
insert into public.categories (id, kind, name)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc','remedy','Baths');
insert into public.catalog_items (id, kind, name, category_id, has_secret, is_published, price)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd','remedy','Secret Bath','cccccccc-cccc-cccc-cccc-cccccccccccc', true, true, 100);
insert into public.catalog_item_secrets (item_id, details)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd','7 leaves of lemon basil ...');
insert into public.item_trusted_helpers (item_id, helper_id)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd','22222222-2222-2222-2222-222222222222'); -- trust helper1 only
insert into public.jobs (id, patient_id, item_id, kind, name, assignee_id, is_paid)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'dddddddd-dddd-dddd-dddd-dddddddddddd','remedy','Secret Bath',
          '22222222-2222-2222-2222-222222222222', true);  -- assigned to helper1, PAID

do $$
declare
  c int; fails int := 0;
  OWNER text := '11111111-1111-1111-1111-111111111111';
  H1    text := '22222222-2222-2222-2222-222222222222'; -- trusted + assigned
  H2    text := '33333333-3333-3333-3333-333333333333'; -- untrusted
  PAT   text := '44444444-4444-4444-4444-444444444444';


begin

  -- 1) owner sees the secret
  execute 'set role authenticated'; perform set_config('test.uid', OWNER, true);
  select count(*) into c from public.catalog_item_secrets; execute 'reset role';
  raise notice '% 1 owner_sees_secret = % (want 1)', case when c=1 then 'PASS' else 'FAIL' end, c;
  if c<>1 then fails:=fails+1; end if;

  -- 2) patient never sees the secret
  execute 'set role authenticated'; perform set_config('test.uid', PAT, true);
  select count(*) into c from public.catalog_item_secrets; execute 'reset role';
  raise notice '% 2 patient_sees_secret = % (want 0)', case when c=0 then 'PASS' else 'FAIL' end, c;
  if c<>0 then fails:=fails+1; end if;

  -- 3) trusted helper, assigned a PAID job -> sees the secret
  execute 'set role authenticated'; perform set_config('test.uid', H1, true);
  select count(*) into c from public.catalog_item_secrets; execute 'reset role';
  raise notice '% 3 trusted_assigned_paid_helper_sees_secret = % (want 1)', case when c=1 then 'PASS' else 'FAIL' end, c;
  if c<>1 then fails:=fails+1; end if;

  -- 4) untrusted helper -> never sees the secret
  execute 'set role authenticated'; perform set_config('test.uid', H2, true);
  select count(*) into c from public.catalog_item_secrets; execute 'reset role';
  raise notice '% 4 untrusted_helper_sees_secret = % (want 0)', case when c=0 then 'PASS' else 'FAIL' end, c;
  if c<>0 then fails:=fails+1; end if;

  -- 6) patient sees their own patient row
  execute 'set role authenticated'; perform set_config('test.uid', PAT, true);
  select count(*) into c from public.patients; execute 'reset role';
  raise notice '% 6 patient_sees_own_record = % (want 1)', case when c=1 then 'PASS' else 'FAIL' end, c;
  if c<>1 then fails:=fails+1; end if;

  -- 7) unrelated helper does NOT see the patient
  execute 'set role authenticated'; perform set_config('test.uid', H2, true);
  select count(*) into c from public.patients; execute 'reset role';
  raise notice '% 7 unrelated_helper_sees_patient = % (want 0)', case when c=0 then 'PASS' else 'FAIL' end, c;
  if c<>0 then fails:=fails+1; end if;

  -- 8) assigned helper DOES see the patient
  execute 'set role authenticated'; perform set_config('test.uid', H1, true);
  select count(*) into c from public.patients; execute 'reset role';
  raise notice '% 8 assigned_helper_sees_patient = % (want 1)', case when c=1 then 'PASS' else 'FAIL' end, c;
  if c<>1 then fails:=fails+1; end if;

  -- 9) patient sees their own jobs (progress)
  execute 'set role authenticated'; perform set_config('test.uid', PAT, true);
  select count(*) into c from public.jobs; execute 'reset role';
  raise notice '% 9 patient_sees_own_jobs = % (want 1)', case when c=1 then 'PASS' else 'FAIL' end, c;
  if c<>1 then fails:=fails+1; end if;

  -- 10) unrelated helper sees no jobs
  execute 'set role authenticated'; perform set_config('test.uid', H2, true);
  select count(*) into c from public.jobs; execute 'reset role';
  raise notice '% 10 unrelated_helper_sees_jobs = % (want 0)', case when c=0 then 'PASS' else 'FAIL' end, c;
  if c<>0 then fails:=fails+1; end if;

  -- 5) unpaid gate: mark the job unpaid, trusted+assigned helper must LOSE the secret
  update public.jobs set is_paid=false where id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  execute 'set role authenticated'; perform set_config('test.uid', H1, true);
  select count(*) into c from public.catalog_item_secrets; execute 'reset role';
  raise notice '% 5 helper_sees_secret_when_unpaid = % (want 0)', case when c=0 then 'PASS' else 'FAIL' end, c;
  if c<>0 then fails:=fails+1; end if;

  if fails>0 then raise exception '% CHECK(S) FAILED', fails;
  else raise notice 'ALL SECURITY CHECKS PASSED'; end if;
end $$;
