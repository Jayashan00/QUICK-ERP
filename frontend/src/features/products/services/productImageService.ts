import type { ProductImage } from '../types/product';
import { storeUploadedFile } from '@/core/persistence/backendSession';
import { productImageStore, revokeProductImageUrl } from './productImageStore';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const maxFileSize = 5 * 1024 * 1024;
const wait = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

function scopedImages(tenantId: string, productId: string) {
  return productImageStore.records
    .filter((image) => image.tenantId === tenantId && image.productId === productId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function normalizeOrder(tenantId: string, productId: string) {
  scopedImages(tenantId, productId).forEach((image, index) => {
    image.sortOrder = index;
    image.updatedAt = new Date().toISOString();
  });
}

function clone(image: ProductImage): ProductImage {
  return { ...image };
}

export const productImageService = {
  async getAll(tenantId: string, productId: string): Promise<ProductImage[]> {
    await wait(100);
    return scopedImages(tenantId, productId).map(clone);
  },

  async upload(
    tenantId: string,
    productId: string,
    files: File[],
    onProgress?: (progress: number) => void,
  ): Promise<ProductImage[]> {
    if (!files.length) return [];
    if (scopedImages(tenantId, productId).length + files.length > 12) {
      throw new Error('A product can contain up to 12 images.');
    }
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) throw new Error(`${file.name} is not a supported JPG, PNG, WebP or GIF image.`);
      if (file.size > maxFileSize) throw new Error(`${file.name} exceeds the 5 MB image limit.`);
    }

    for (const progress of [15, 35, 60, 85, 100]) {
      await wait(70);
      onProgress?.(progress);
    }

    const existing = scopedImages(tenantId, productId);
    const timestamp = new Date().toISOString();
    const fileUrls = await Promise.all(files.map((file) => storeUploadedFile(file)));
    const uploaded = files.map((file, index): ProductImage => {
      const objectUrl = fileUrls[index];
      return {
        id: `product-image-${crypto.randomUUID().slice(0, 8)}`,
        tenantId,
        productId,
        url: objectUrl,
        previewUrl: objectUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        isPrimary: existing.length === 0 && index === 0,
        sortOrder: existing.length + index,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
    productImageStore.records = [...productImageStore.records, ...uploaded];
    return uploaded.map(clone);
  },

  async setPrimary(tenantId: string, productId: string, imageId: string): Promise<ProductImage[]> {
    await wait(160);
    const target = productImageStore.records.find((image) => image.tenantId === tenantId && image.productId === productId && image.id === imageId);
    if (!target) throw new Error('Product image not found.');
    const timestamp = new Date().toISOString();
    productImageStore.records = productImageStore.records.map((image) => image.tenantId === tenantId && image.productId === productId ? { ...image, isPrimary: image.id === imageId, updatedAt: timestamp } : image);
    return scopedImages(tenantId, productId).map(clone);
  },

  async remove(tenantId: string, productId: string, imageId: string): Promise<void> {
    await wait(160);
    const image = productImageStore.records.find((item) => item.tenantId === tenantId && item.productId === productId && item.id === imageId);
    if (!image) throw new Error('Product image not found.');
    revokeProductImageUrl(image);
    productImageStore.records = productImageStore.records.filter((item) => !(item.tenantId === tenantId && item.productId === productId && item.id === imageId));
    normalizeOrder(tenantId, productId);
    const remaining = scopedImages(tenantId, productId);
    if (image.isPrimary && remaining.length > 0) {
      remaining[0].isPrimary = true;
      remaining[0].updatedAt = new Date().toISOString();
    }
  },

  async move(tenantId: string, productId: string, imageId: string, direction: 'left' | 'right'): Promise<ProductImage[]> {
    await wait(140);
    const images = scopedImages(tenantId, productId);
    const index = images.findIndex((image) => image.id === imageId);
    if (index < 0) throw new Error('Product image not found.');
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return images.map(clone);
    const currentOrder = images[index].sortOrder;
    images[index].sortOrder = images[targetIndex].sortOrder;
    images[targetIndex].sortOrder = currentOrder;
    images[index].updatedAt = new Date().toISOString();
    images[targetIndex].updatedAt = new Date().toISOString();
    return scopedImages(tenantId, productId).map(clone);
  },

  async attachToProduct(tenantId: string, temporaryProductId: string, productId: string): Promise<ProductImage[]> {
    await wait(120);
    productImageStore.records = productImageStore.records.map((image) => image.tenantId === tenantId && image.productId === temporaryProductId ? { ...image, productId, updatedAt: new Date().toISOString() } : image);
    normalizeOrder(tenantId, productId);
    return scopedImages(tenantId, productId).map(clone);
  },

  discardTemporary(tenantId: string, temporaryProductId: string) {
    const discarded = scopedImages(tenantId, temporaryProductId);
    discarded.forEach(revokeProductImageUrl);
    productImageStore.records = productImageStore.records.filter((image) => !(image.tenantId === tenantId && image.productId === temporaryProductId));
  },
};
