-- Narrow index for the common tenant/collection/branch predicate on individual ERP records.
CREATE INDEX ix_erp_records_ai_branch ON erp_records (tenant_id, collection, (data->>'branchId'))
    WHERE NOT deleted AND data IS NOT NULL AND record_id NOT IN ('__all__', '__order__', '__value__');
