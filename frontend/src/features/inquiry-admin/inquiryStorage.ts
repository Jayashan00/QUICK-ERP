export type InquiryStatus = 'new' | 'contacted' | 'qualified' | 'archived';

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  interest: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type NewInquiry = Pick<Inquiry, 'name' | 'email' | 'company' | 'phone' | 'interest' | 'message'>;

export const INQUIRY_STORAGE_KEY = 'vyro.public-inquiries.preview.v1';

export function readInquiries(): Inquiry[] {
  try {
    const stored = window.localStorage.getItem(INQUIRY_STORAGE_KEY);
    if (!stored) return [];
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value as Inquiry[] : [];
  } catch {
    return [];
  }
}

function writeInquiries(inquiries: Inquiry[]) {
  window.localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(inquiries));
}

export function saveInquiry(details: NewInquiry): Inquiry {
  const now = new Date().toISOString();
  const inquiry: Inquiry = {
    ...details,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: 'new',
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
  };
  writeInquiries([inquiry, ...readInquiries()]);
  return inquiry;
}

export function changeInquiryStatus(id: string, status: InquiryStatus): Inquiry[] {
  const inquiries = readInquiries().map((inquiry) => inquiry.id === id
    ? { ...inquiry, status, updatedAt: new Date().toISOString(), updatedBy: 'Local preview' }
    : inquiry);
  writeInquiries(inquiries);
  return inquiries;
}
