-- Remove only inline image data from Auth metadata; preserve names, roles, and other fields.
UPDATE auth.users AS auth_user
SET raw_user_meta_data = auth_user.raw_user_meta_data - ARRAY(
  SELECT metadata.key
  FROM jsonb_each_text(auth_user.raw_user_meta_data) AS metadata(key, value)
  WHERE metadata.value LIKE 'data:image/%'
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_each_text(auth_user.raw_user_meta_data) AS metadata(key, value)
  WHERE metadata.value LIKE 'data:image/%'
);