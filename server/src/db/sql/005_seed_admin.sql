BEGIN;

INSERT INTO admins (
  email,
  password_hash,
  full_name,
  is_active
)
VALUES (
  'resulramadani35@gmail.com',
  '$2b$10$pvpeb3XQW4lCTs3ejnWCcOVvEI1XoiRzjsfOYcZia7IJhjs6Pvxja',
  'Resul Ramadani',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;