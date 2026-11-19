# Database security tests

`rls_security_test.sql` proves the row-level-security rules, especially the
**private-recipe secrecy**. It sets up an owner, a trusted helper, an untrusted
helper and a patient, then checks who can see what.

Checks (all must pass):

| # | Check | Expected |
|---|-------|----------|
| 1 | owner sees a recipe secret | yes |
| 2 | patient sees a recipe secret | no |
| 3 | trusted helper, assigned a **paid** job, sees the secret | yes |
| 4 | untrusted helper sees the secret | no |
| 5 | trusted+assigned helper after the job is marked **unpaid** | no |
| 6 | patient sees their own record | yes |
| 7 | unrelated helper sees the patient | no |
| 8 | assigned helper sees the patient | yes |
| 9 | patient sees their own jobs (progress) | yes |
| 10 | unrelated helper sees any jobs | no |

## Run locally (no cloud)

```bash
sudo supabase/tests/run_local.sh
```

Spins up a throwaway PostgreSQL, applies the core migration with a small
Supabase-style auth shim (`auth.users`, `auth.uid()`), and runs the checks.

## Run against a Supabase project

Apply the migrations, then run `rls_security_test.sql` through `psql` against the
project's database (it uses a `test.uid` setting to stand in for `auth.uid()`),
or adapt it into a pgTAP suite under `supabase db test`.
