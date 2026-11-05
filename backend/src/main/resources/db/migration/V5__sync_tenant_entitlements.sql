-- Backfill the relational tenant profile from the Super Admin-controlled platform foundation.
-- Invalid or incomplete configurations are deliberately skipped, leaving the tenant deny-by-default.
WITH foundation AS (
    SELECT data
    FROM erp_records
    WHERE tenant_id = 'platform'
      AND collection = 'platform.foundation'
      AND record_id = '__value__'
      AND NOT deleted
    ORDER BY change_seq DESC
    LIMIT 1
), configurations AS (
    SELECT tenant
    FROM foundation, LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(data -> 'tenants') = 'array' THEN data -> 'tenants' ELSE '[]'::jsonb END
    ) tenant
    WHERE jsonb_typeof(tenant -> 'enabledModules') = 'array'
      AND tenant -> 'enabledModules' ? 'settings'
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(tenant -> 'enabledModules') module
          WHERE module <> ALL (ARRAY[
              'hr','inventory','stock','crm','customers','suppliers','products','sales','purchases',
              'finance','projects','pos','web_store','reports','documents','notifications','settings'
          ])
      )
      AND (NOT (tenant -> 'enabledModules' ? 'sales') OR (tenant -> 'enabledModules' ?& ARRAY['customers','products']))
      AND (NOT (tenant -> 'enabledModules' ? 'purchases') OR (tenant -> 'enabledModules' ?& ARRAY['suppliers','products']))
      AND (NOT (tenant -> 'enabledModules' ? 'inventory') OR (tenant -> 'enabledModules' ? 'products'))
      AND (NOT (tenant -> 'enabledModules' ? 'stock') OR (tenant -> 'enabledModules' ? 'inventory'))
      AND (NOT (tenant -> 'enabledModules' ? 'pos') OR (tenant -> 'enabledModules' ?& ARRAY['sales','inventory']))
      AND (NOT (tenant -> 'enabledModules' ? 'web_store') OR (tenant -> 'enabledModules' ?& ARRAY['sales','inventory']))
)
UPDATE tenants target
SET status = CASE WHEN configurations.tenant ->> 'status' IN ('active', 'suspended')
                  THEN configurations.tenant ->> 'status' ELSE target.status END,
    profile = jsonb_set(
        jsonb_set(target.profile, '{status}', to_jsonb(CASE WHEN configurations.tenant ->> 'status' IN ('active', 'suspended')
                  THEN configurations.tenant ->> 'status' ELSE target.status END), true),
        '{entitlements}',
        jsonb_build_object(
            'enabledModules', configurations.tenant -> 'enabledModules',
            'limits', COALESCE(configurations.tenant -> 'limits', '{}'::jsonb),
            'usage', COALESCE(configurations.tenant -> 'usage', '{}'::jsonb),
            'admin', COALESCE(configurations.tenant -> 'admin', '{}'::jsonb)
        ),
        true
    ),
    updated_at = now()
FROM configurations
WHERE target.id = configurations.tenant ->> 'id';
