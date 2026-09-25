import { describe, it, expect } from 'vitest';
import {
  checkIPv4,
  checkIPv6,
  isBlockedIp,
  assertSafeHttpUrl,
  assertSafeRedirect,
  parseIPv4,
} from '../supabase/functions/_shared/ssrf.ts';
import { TALError } from '../supabase/functions/_shared/errors.ts';

const publicResolver = async (host: string) => {
  if (host === 'example.com') return ['93.184.216.34'];
  if (host === 'internal.local') return ['192.168.1.10'];
  return ['10.0.0.1'];
};

describe('ssrf', () => {
  it('blocks private and loopback IPv4 literals', () => {
    expect(isBlockedIp('10.0.0.1').blocked).toBe(true);
    expect(isBlockedIp('127.0.0.1').blocked).toBe(true);
    expect(isBlockedIp('169.254.169.254').blocked).toBe(true);
    expect(isBlockedIp('172.16.9.9').blocked).toBe(true);
    expect(isBlockedIp('192.168.0.1').blocked).toBe(true);
    expect(isBlockedIp('100.64.0.1').blocked).toBe(true);
    expect(isBlockedIp('0.0.0.0').blocked).toBe(true);
    expect(isBlockedIp('223.255.255.255').blocked).toBe(false);
    expect(isBlockedIp('93.184.216.34').blocked).toBe(false);
  });

  it('blocks IPv6 loopback, ULA, link-local and mapped private ranges', () => {
    expect(isBlockedIp('::1').blocked).toBe(true);
    expect(isBlockedIp('::').blocked).toBe(true);
    expect(isBlockedIp('fd00::1').blocked).toBe(true);
    expect(isBlockedIp('fe80::1').blocked).toBe(true);
    expect(isBlockedIp('2001:db8::1').blocked).toBe(false);
    expect(isBlockedIp('::ffff:192.168.0.1').blocked).toBe(true);
    expect(isBlockedIp('::ffff:8.8.8.8').blocked).toBe(false);
  });

  it('rejects non-http schemes', async () => {
    await expect(assertSafeHttpUrl('file:///etc/passwd', publicResolver)).rejects.toBeInstanceOf(TALError);
    await expect(assertSafeHttpUrl('ftp://x.com/y', publicResolver)).rejects.toBeInstanceOf(TALError);
  });

  it('blocks hostnames resolving to private IPs', async () => {
    await expect(assertSafeHttpUrl('http://internal.local/x', publicResolver)).rejects.toMatchObject({ code: 'ssrf_blocked' });
    await expect(assertSafeHttpUrl('http://example.com/x', publicResolver)).resolves.toBeInstanceOf(URL);
  });

  it('guards redirect hops and cross-host moves', async () => {
    await expect(assertSafeRedirect('http://internal.local/next', publicResolver, { originalHost: 'example.com' })).rejects.toBeInstanceOf(TALError);
    await expect(assertSafeRedirect('http://other.com/x', publicResolver, { originalHost: 'example.com' })).rejects.toMatchObject({ code: 'ssrf_blocked' });
    await expect(assertSafeRedirect('http://example.com/next', publicResolver, { originalHost: 'example.com' })).resolves.toBeInstanceOf(URL);
  });

  it('parses IPv4 out of bounds as invalid', () => {
    expect(parseIPv4('999.1.1.1')).toBeNull();
    expect(parseIPv4('1.2')).toBeNull();
  });
});