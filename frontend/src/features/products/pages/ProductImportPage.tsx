import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { ImportWizard } from '@/shared/components/import';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import type { ImportColumnDefinition } from '@/shared/types/import-record';
import { appToast } from '@/shared/utils/toast';
import { useProductImport } from '../hooks/useProductImport';

const columns: ImportColumnDefinition[] = [
  { key: 'name', label: 'Product Name', required: true }, { key: 'sku', label: 'SKU', required: true }, { key: 'barcode', label: 'Barcode' }, { key: 'category', label: 'Category ID / Code / Name', required: true }, { key: 'uom', label: 'UOM ID / Code / Name', required: true }, { key: 'costPrice', label: 'Purchase / Cost Price', required: true }, { key: 'sellingPrice', label: 'Selling Price', required: true }, { key: 'status', label: 'Status', required: true }, { key: 'type', label: 'Product Type' }, { key: 'trackInventory', label: 'Track Inventory' },
];

function downloadTemplate() {
  const csv = 'name,sku,barcode,category,uom,costPrice,sellingPrice,status,type,trackInventory\nSample Product,SAMPLE-001,1234567890128,ELEC,UNIT,10,15,active,goods,true';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'quick-erp-product-import-template.csv'; anchor.click(); URL.revokeObjectURL(url); appToast.success('Product import template downloaded.');
}

export function ProductImportPage() {
  const navigate = useNavigate(); const importer = useProductImport();
  return <PageContainer><div className="mb-4"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products')}>Back to Products</Button></div><PageHeader title="Import Products" description="Validate and review tenant product master data before importing it into frontend mock storage." actions={<Button variant="secondary" leftIcon={<Download size={16} />} onClick={downloadTemplate}>Download Template</Button>} /><Card className="mb-6"><div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 text-blue-600" size={20} /><div><h2 className="text-sm font-semibold text-slate-900">Import guidance</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600"><li>Use active category and UOM IDs, codes or exact names from this tenant.</li><li>SKU and barcode values must be tenant-unique.</li><li>Prices must be non-negative; status must be draft, active, inactive or archived.</li><li>Excel files use representative mock rows until a real parser/backend import job is connected.</li></ul></div></div></Card><ImportWizard title="Product Import Wizard" columns={columns} prepareFile={importer.prepareFile} previewFile={importer.previewFile} importRows={importer.importRows} onDownloadTemplate={downloadTemplate} /></PageContainer>;
}
