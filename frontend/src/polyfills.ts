// crypto.randomUUID only exists on secure pages (HTTPS, or localhost). When the app is opened over plain
// http (for example a server reached by its IP address), browsers leave it out and the app cannot start.
// This adds a standard version 4 UUID built from crypto.getRandomValues, which browsers provide everywhere.
// It must be imported before anything else (see main.tsx).
type Uuid = `${string}-${string}-${string}-${string}-${string}`;

if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID !== 'function') {
  const randomUUID = (): Uuid => {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true, writable: true });
}

export {};