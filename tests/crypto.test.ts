import { describe, it, expect, vi } from 'vitest';
import { encryptSecret, decryptSecret } from '../supabase/functions/_shared/crypto.ts';

describe('credential vault crypto', () => {
  it('round-trips a secret', async () => {
    const secret = JSON.stringify({ apiKey: 'sk-test-123', endpoint: 'https://x' });
    const encrypted = await encryptSecret(secret);
    expect(encrypted.startsWith('talv1:')).toBe(true);
    expect(encrypted).not.toContain('sk-test-123');
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('produces different ciphertexts for the same secret (random IV)', async () => {
    const a = await encryptSecret('same');
    const b = await encryptSecret('same');
    expect(a).not.toBe(b);
  });

  it('rejects unknown formats', async () => {
    await expect(decryptSecret('nope')).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    const c = await encryptSecret('secret-value');
    const tampered = c.slice(0, -2) + (c.endsWith('00') ? '11' : '00');
    await expect(decryptSecret(tampered)).rejects.toThrow();
  });
});