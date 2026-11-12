-- Replace the former approval gate with an explicit tenant-admin escalation.
-- Previously approved tickets remain visible to platform support as already sent.
UPDATE erp_records
SET data = (data - 'approvalStatus' - 'approvedBy' - 'approvedAt')
        || jsonb_build_object(
            'status', CASE data->>'status'
                WHEN 'open' THEN 'new'
                WHEN 'waiting_for_user' THEN 'in_progress'
                ELSE data->>'status'
            END
        )
        || CASE WHEN data->>'approvalStatus' = 'approved'
            THEN jsonb_build_object(
                'sentToSuperAdminBy', COALESCE(data->'approvedBy', jsonb_build_object('id', 'system:migration', 'name', 'Existing platform workflow')),
                'sentToSuperAdminAt', COALESCE(NULLIF(data->>'approvedAt', ''), NULLIF(data->>'updatedAt', ''), NULLIF(data->>'createdAt', ''), updated_at::text)
            )
            ELSE '{}'::jsonb
        END,
    version = version + 1,
    change_seq = nextval('erp_change_seq'),
    updated_at = now(),
    updated_by = 'system:support-escalation-migration',
    client_id = 'support-escalation-migration'
WHERE collection = 'support.tickets'
  AND NOT deleted
  AND jsonb_typeof(data) = 'object'
  AND record_id NOT IN ('__order__', '__all__', '__value__');
