import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const work = await mkdtemp(path.join(process.cwd(), '.quick-ai-qa-'));
const output = path.join(work, 'components.mjs');
try {
  await build({
    stdin: {
      contents: `export { AiStructuredResult } from './src/features/ai-assistant/components/AiStructuredResult.tsx';
export { AiActionPreview } from './src/features/ai-assistant/components/AiActionPreview.tsx';
export { PermissionContext } from './src/core/permissions/permission-context.ts';`,
      resolveDir: process.cwd(), sourcefile: 'ai-qa-entry.ts', loader: 'ts',
    },
    outfile: output, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external',
    alias: { '@': path.join(process.cwd(), 'src') }, logLevel: 'silent',
    plugins: [{ name: 'test-tenant-link', setup(bundle) {
      bundle.onResolve({ filter: /^@\/core\/routing\/TenantLink$/ }, () => ({ path: 'test-tenant-link', namespace: 'qa' }));
      bundle.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({
        contents: `import React from 'react'; export function TenantLink({to, children, ...props}) {
          return React.createElement('a', {href: to, ...props}, children);
        }`, loader: 'js', resolveDir: process.cwd(),
      }));
    } }],
  });
  const { AiStructuredResult, AiActionPreview, PermissionContext } = await import(pathToFileURL(output).href);
  const value = { permissions: [], isLoading: false, hasPermission: () => false,
    hasAnyPermission: () => false, hasAllPermissions: () => false,
    canAccessModule: () => false, hasModule: () => false };
  const render = (Component, data, permitted = false) => renderToStaticMarkup(React.createElement(PermissionContext.Provider,
    { value: permitted ? { ...value, hasPermission: () => true } : value }, React.createElement(Component, { value: data })));

  const rows = render(AiStructuredResult, { operation: 'query_erp_records', status: 'SUCCESS',
    resource: 'customers', data: [{ id: 'customer-a', name: '<script>alert(1)</script>', status: 'active' }], count: 1 });
  assert.match(rows, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(rows, /href=/);
  assert.match(rows, /<th[^>]*scope="col"/);
  assert.match(render(AiStructuredResult, { operation: 'query_erp_records', status: 'SUCCESS', resource: 'customers',
    data: [{ id: 'customer-a', name: 'Asha' }] }, true), /href="[^\"]*customers\?record=customer-a"/);
  assert.doesNotMatch(render(AiStructuredResult, { operation: 'query_erp_records', status: 'SUCCESS', resource: 'customers',
    data: [{ id: 'https://evil.test', name: 'Asha' }] }, true), /href=/);

  const metric = render(AiStructuredResult, { operation: 'aggregate_erp_data', status: 'SUCCESS',
    metric: 'sum', field: 'totalAmount', resource: 'sales_invoices',
    data: [{ currency: 'LKR', recordCount: 2, value: 850000 }] });
  assert.match(metric, /850,000/);
  assert.match(metric, /LKR/);
  assert.equal(render(AiStructuredResult, { operation: 'query_erp_records', status: 'EMPTY', data: [] })
    .includes('No matching records'), true);
  const comparison = render(AiStructuredResult, { operation: 'compare_erp_data', status: 'SUCCESS',
    data: [{ label: 'October', startInclusive: '2026-10-01', endExclusive: '2026-11-01', groups: [{ currency: 'USD', value: 100 }] },
      { label: 'September', startInclusive: '2026-09-01', endExclusive: '2026-10-01', groups: [{ currency: 'USD', value: 80 }] }],
    difference: { absolute: 20, percent: 25 } });
  assert.match(comparison, /Verified difference/);
  assert.match(comparison, /25%/);

  const preview = render(AiActionPreview, { handoffOnly: true, operation: 'prepare_sales_quotation',
    title: 'Quotation draft', branchId: 'branch-a',
    proposedFields: { customerId: 'customer-a', productId: 'product-a', quantity: 5 },
    missingRequiredFields: ['tax review'], warnings: ['No record was saved.'] });
  assert.match(preview, /No ERP record has been created/);
  assert.doesNotMatch(preview, /href=/);
  assert.match(render(AiActionPreview, { handoffOnly: true, operation: 'prepare_sales_quotation',
    title: 'Quotation draft', branchId: 'branch-a',
    proposedFields: { customerId: 'customer-a', productId: 'product-a', quantity: 5 },
    missingRequiredFields: ['tax review'], warnings: [] }, true), /Continue in ERP form/);
  console.log('AI assistant render QA passed: escaping, scoped links, table, KPI, empty state, draft handoff.');
} finally {
  await unlink(output).catch(() => {});
  await rmdir(work);
}
