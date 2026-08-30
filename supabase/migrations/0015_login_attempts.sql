-- Rate limiting for the login form.
--
-- The app runs on serverless functions, so an in-process counter is useless:
-- each request may land on a fresh instance, and an attacker gets a clean
-- allowance every time. The only state every instance shares is Postgres, so
-- the attempt counter lives here.
--
-- Keyed by username rather than IP: the shop has three accounts and a single
-- premises, so locking the *account* is what protects it, and an IP key would
-- lock out the whole shop the moment they share a connection.

create table if not exists login_attempts (
  username      text primary key,
  failed_count  int not null default 0,
  -- When the current lockout expires. Null means "not locked".
  locked_until  timestamptz,
  last_failure  timestamptz not null default now()
);

-- No policies, matching every other table here: all access is through the
-- service role in the server-side adapter, never from a browser.
alter table login_attempts enable row level security;

comment on table login_attempts is
  'Per-username failed login counter backing the login rate limit. Rows are created on first failure and deleted on success.';
