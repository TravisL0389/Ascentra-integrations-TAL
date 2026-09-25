// Credential vault crypto. AES-256-GCM with a key derived from TAL_CREDENTIALS_KEY.
// Uses WebCrypto (globalThis.crypto) — available in Deno and Node 18+.

const PREFIX = 'talv1:';

function toBytes(value: string | Uint8Array | null | undefined): Uint8Array<ArrayBuffer> {
  if (value instanceof Uint8Array) return value as Uint8Array<ArrayBuffer>;
  return new TextEncoder().encode(value ?? '') as Uint8Array<ArrayBuffer>;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    toBytes(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toBytes('tal-credential-vault'),
      iterations: 210_000,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(secret: string): Promise<string> {
  const keyEnv = Deno.env.get('TAL_CREDENTIALS_KEY');
  if (!keyEnv) throw new Error('TAL_CREDENTIALS_KEY is not configured');
  const key = await deriveKey(keyEnv);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toBytes(secret));
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return `${PREFIX}${bytesToHex(combined)}`;
}

export async function decryptSecret(value: string): Promise<string> {
  const keyEnv = Deno.env.get('TAL_CREDENTIALS_KEY');
  if (!keyEnv) throw new Error('TAL_CREDENTIALS_KEY is not configured');
  if (!value.startsWith(PREFIX)) {
    throw new Error('Unsupported credential format');
  }
  const hex = value.slice(PREFIX.length);
  const combined = hexToBytes(hex);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveKey(keyEnv);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}