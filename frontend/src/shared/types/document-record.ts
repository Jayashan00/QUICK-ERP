import type { EntityId } from '@/shared/types/common';

export interface DocumentRecord {
  id: EntityId;
  name: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  expiryDate?: string;
  entityType?: string;
  entityId?: EntityId;
  entityReference?: string;
  url?: string;
  previewUrl?: string;
}
