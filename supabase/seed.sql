-- One-time bootstrap: there is no signup flow, so the first admin account
-- must be inserted manually before staff CRUD can create anyone else.
--
-- 1. Generate a bcrypt hash for the admin's chosen password:
--      node scripts/hash-password.mjs "your-chosen-password"
-- 2. Paste the resulting hash below and run this file in the Supabase SQL editor.
--    Do not commit the plaintext password anywhere.

insert into staff (username, password_hash, name, role)
values ('admin', '<paste-bcrypt-hash-here>', 'Admin', 'admin');
