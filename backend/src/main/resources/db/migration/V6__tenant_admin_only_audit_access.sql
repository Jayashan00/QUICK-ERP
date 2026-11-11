-- Audit logs belong exclusively to each company's tenant administrator.
-- Remove legacy audit permissions from every other role and publish the change through normal state sync.
UPDATE erp_records
SET data = jsonb_set(
        data,
        '{permissions}',
        COALESCE(
            (SELECT jsonb_agg(value)
             FROM jsonb_array_elements_text(COALESCE(data->'permissions', '[]'::jsonb)) AS permissions(value)
             WHERE value NOT LIKE 'audit.%'),
            '[]'::jsonb
        ),
        TRUE
    ),
    version = version + 1,
    change_seq = nextval('erp_change_seq'),
    updated_at = now(),
    updated_by = 'migration:v6',
    client_id = 'server:migration'
WHERE collection = 'core.roles'
  AND record_id <> 'role-001'
  AND NOT deleted
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(data->'permissions', '[]'::jsonb)) AS permissions(value)
      WHERE value LIKE 'audit.%'
  );
