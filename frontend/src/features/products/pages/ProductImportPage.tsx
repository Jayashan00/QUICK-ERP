import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { ImportWizard } from '@/shared/components/import';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { useProductImport } from '../hooks/useProductImport';
import { buildProductImportTemplateCsv, productImportColumns } from '../services/productImportService';

function downloadTemplate() {
  const csv = `\uFEFF${buildProductImportTemplateCsv()}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'quick-erp-product-service-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
  appToast.success('Product and service import template downloaded.');
}

export function ProductImportPage() {
  const navigate = useNavigate(); const importer = useProductImport();
  return <PageContainer><div className="mb-4"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products')}>Back to Products</Button></div><PageHeader title="Import Products or Services" description="Validate and review tenant product and service master data before importing it into frontend storage." actions={<Button variant="secondary" leftIcon={<Download size={16} />} onClick={downloadTemplate}>Download Template</Button>} /><Card className="mb-6"><div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 text-blue-600" size={20} /><div><h2 className="text-sm font-semibold text-slate-900">Import guidance</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600"><li>The template contains separate example rows for a product and a service; replace or remove both examples before importing.</li><li>Use active category, brand and UOM IDs, codes or exact names from this tenant. Services do not use brand, barcode, UOM or stock fields.</li><li>Product and service codes are generated automatically. Optional barcodes must be tenant-unique.</li><li>Use true/false for switches. Prices and stock limits must be non-negative; status must be draft, active, inactive or archived.</li><li>Opening stock is an inventory transaction and is not included in this master-data template.</li><li>CSV, XLSX and XLS files are read from the selected file. The first row must contain column headers.</li></ul></div></div></Card><ImportWizard title="Product and Service Import Wizard" columns={productImportColumns} prepareFile={importer.prepareFile} previewFile={importer.previewFile} importRows={importer.importRows} /></PageContainer>;
}
