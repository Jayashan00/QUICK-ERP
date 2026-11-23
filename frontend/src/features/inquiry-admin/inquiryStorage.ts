import { getBackendToken, isBackendEnabled } from '@/core/persistence/backendSession';

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

const endpoint = '/website-api/inquiries';

export class InquiryApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The inquiry service is unavailable. Please try again.');
  }
  const data = await response.json();
  if (!response.ok) throw new InquiryApiError(data.error || 'The inquiry request failed.', response.status);
  return data;
}

export async function saveInquiry(details: NewInquiry & { contact_check: string }) {
  const receipt = await request(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
  });
  if (typeof receipt?.id !== 'string' || !receipt.id) {
    throw new Error('We could not confirm that your inquiry was saved. Please contact us by phone or email.');
  }
  return receipt as { id: string; createdAt: string };
}

export function readInquiries(): Promise<Inquiry[]> {
  return request(endpoint, { headers: adminHeaders() });
}

function adminHeaders(): Record<string, string> {
  if (!isBackendEnabled()) throw new Error('Website inquiries require the ERP backend. Enable backend mode and sign in with an ERP super admin account.');
  const token = getBackendToken();
  if (!token) throw new InquiryApiError('Sign in with your ERP super admin account to view inquiries.', 401);
  return { Authorization: `Bearer ${token}` };
}

export function changeInquiryStatus(inquiry: Inquiry, status: InquiryStatus): Promise<Inquiry> {
  return request(`${endpoint}/${inquiry.id}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, previous: inquiry.status }),
  });
}
