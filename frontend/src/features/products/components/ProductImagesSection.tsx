import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { IconButton } from '@/shared/components/common/IconButton';
import { Modal } from '@/shared/components/common/Modal';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { useProductImages } from '../hooks/useProductImages';
import type { ProductImage } from '../types/product';
import { ProductSectionSkeleton } from './ProductLoadingStates';

interface ProductImagesSectionProps {
  productId: string;
  canManage: boolean;
}

export function ProductImagesSection({ productId, canManage }: ProductImagesSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const images = useProductImages(productId);
  const [previewing, setPreviewing] = useState<ProductImage | null>(null);
  const [removing, setRemoving] = useState<ProductImage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setActionError(null);
    try {
      await images.upload(Array.from(files));
      appToast.success(`${files.length} product image${files.length === 1 ? '' : 's'} uploaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload product images.';
      setActionError(message);
      appToast.error(message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setActionError(null);
    try {
      await action();
      appToast.success(success);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update product images.';
      setActionError(message);
      appToast.error(message);
      return false;
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Product Images</h2>
          <p className="mt-1 text-sm text-slate-500">Upload up to 12 JPG, PNG, WebP or GIF images, with a 5 MB limit per image.</p>
        </div>
        {canManage && (
          <>
            <input ref={inputRef} type="file" aria-label="Upload product images" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
            <Button type="button" leftIcon={<ImagePlus size={16} />} isLoading={images.isUploading} onClick={() => inputRef.current?.click()}>Upload Images</Button>
          </>
        )}
      </div>

      {images.isUploading && (
        <div className="mt-4" aria-live="polite">
          <div className="mb-1 flex justify-between text-xs text-slate-600"><span>Uploading images...</span><span>{images.uploadProgress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${images.uploadProgress}%` }} /></div>
        </div>
      )}

      {actionError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

      {images.error ? (
        <div className="mt-4"><ErrorState message={images.error} onRetry={() => void images.refetch()} /></div>
      ) : images.isLoading ? (
        <ProductSectionSkeleton rows={2} />
      ) : images.images.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <ImagePlus className="mx-auto text-slate-400" size={28} />
          <p className="mt-2 text-sm font-medium text-slate-700">No product images</p>
          <p className="mt-1 text-xs text-slate-500">{canManage ? 'Upload an image to create the product gallery.' : 'No images have been added to this product.'}</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.images.map((image, index) => (
            <div key={image.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white">
              <button type="button" aria-label={`Preview ${image.fileName}`} className="relative block aspect-square w-full overflow-hidden bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setPreviewing(image)}>
                <img src={image.previewUrl} alt={image.fileName} className="size-full object-cover transition-transform group-hover:scale-105" />
                {image.isPrimary && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white"><Star size={11} fill="currentColor" />Primary</span>}
              </button>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-slate-700" title={image.fileName}>{image.fileName}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{Math.max(1, Math.round(image.sizeBytes / 1024))} KB · Position {index + 1}</p>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1">
                  <IconButton type="button" icon={<Eye size={15} />} label="Preview image" onClick={() => setPreviewing(image)} />
                  {canManage && (
                    <div className="flex items-center">
                      <IconButton type="button" icon={<ArrowLeft size={15} />} label="Move image left" disabled={index === 0 || images.isSaving} onClick={() => void runAction(() => images.move(image.id, 'left'), 'Image order updated.')} />
                      <IconButton type="button" icon={<ArrowRight size={15} />} label="Move image right" disabled={index === images.images.length - 1 || images.isSaving} onClick={() => void runAction(() => images.move(image.id, 'right'), 'Image order updated.')} />
                      {!image.isPrimary && <IconButton type="button" icon={<Star size={15} />} label="Set as primary image" disabled={images.isSaving} onClick={() => void runAction(() => images.setPrimary(image.id), 'Primary image updated.')} />}
                      <IconButton type="button" icon={<Trash2 size={15} />} label="Remove image" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={images.isSaving} onClick={() => setRemoving(image)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(previewing)} onClose={() => setPreviewing(null)} title={previewing?.fileName ?? 'Image Preview'} maxWidth="900px" footer={<Button type="button" variant="secondary" onClick={() => setPreviewing(null)}>Close</Button>}>
        {previewing && <img src={previewing.previewUrl} alt={previewing.fileName} className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg object-contain" />}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(removing)}
        title="Remove Product Image"
        message={`Remove "${removing?.fileName ?? 'this image'}"? If it is primary, the next image will become primary automatically.`}
        confirmLabel="Remove Image"
        variant="danger"
        isLoading={images.isRemoving}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          void runAction(() => images.remove(removing.id), 'Product image removed.').then((removed) => {
            if (removed) setRemoving(null);
          });
        }}
      />
    </Card>
  );
}
