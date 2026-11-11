-- Existing support tickets predate the tenant-approval workflow. Preserve them as
-- already approved so the platform queue does not lose previously submitted work.
UPDATE erp_records AS records
SET data = records.data
        || jsonb_build_object(
            'companyName', tenants.name,
            'approvalStatus', 'approved',
            'approvedBy', jsonb_build_object('id', 'system:migration', 'name', 'Existing approved workflow'),
            'approvedAt', COALESCE(NULLIF(records.data->>'updatedAt', ''), NULLIF(records.data->>'createdAt', ''), records.updated_at::text)
        ),
    version = records.version + 1,
    change_seq = nextval('erp_change_seq'),
    updated_at = now(),
    updated_by = 'system:support-approval-migration',
    client_id = 'support-approval-migration'
FROM tenants
WHERE records.tenant_id = tenants.id
  AND records.collection = 'support.tickets'
  AND NOT records.deleted
  AND jsonb_typeof(records.data) = 'object'
  AND records.record_id NOT IN ('__order__', '__all__', '__value__')
  AND COALESCE(records.data->>'approvalStatus', '') = '';
