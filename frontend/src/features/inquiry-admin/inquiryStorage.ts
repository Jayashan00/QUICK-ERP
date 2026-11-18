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
  return request(endpoint, {});
}

export function changeInquiryStatus(inquiry: Inquiry, status: InquiryStatus): Promise<Inquiry> {
  return request(`${endpoint}/${inquiry.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, previous: inquiry.status }),
  });
}

export async function loginWebsiteAdmin(email: string, password: string, remember: boolean): Promise<boolean> {
  let adminEmail = 'website-admin@vyro.com';
  try {
    const response = await fetch('/website-api/auth/config', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const config = await response.json();
      if (typeof config.email === 'string') adminEmail = config.email;
    }
  } catch {
    // The ERP sign-in path remains available when the website service is offline.
  }
  if (email.trim().toLowerCase() !== adminEmail) return false;
  await request('/website-api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember }),
  });
  return true;
}

export function logoutWebsiteAdmin() {
  return request('/website-api/auth/logout', { method: 'POST' });
}
