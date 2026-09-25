// SSRF protection for the HTTP atom. Pure, dependency-free, DNS resolver injected.
//
// Workers (Deno) call `assertSafeHttpUrl(url, denoResolve)`; tests pass a stub
// resolver so the blocking logic stays unit-testable in Node.

import { TALError } from './errors.ts';

export type DNSResolver = (hostname: string) => Promise<string[]> | string[];

export interface IPCheck {
  blocked: boolean;
  reason?: string;
}

// --- IPv4 -------------------------------------------------------------------

export function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

export function checkIPv4(b: number[]): IPCheck {
  const [a, c, d] = b;
  const second = b[1];
  if (a === 0 || a === 127) return { blocked: true, reason: 'loopback/reserved' };
  if (a === 10) return { blocked: true, reason: 'private (10/8)' };
  if (a === 100 && second >= 64 && second <= 127) return { blocked: true, reason: 'CGNAT (100.64/10)' };
  if (a === 169 && second === 254) return { blocked: true, reason: 'link-local (169.254/16)' };
  if (a === 172 && second >= 16 && second <= 31) return { blocked: true, reason: 'private (172.16/12)' };
  if (a === 192) {
    if (second === 168) return { blocked: true, reason: 'private (192.168/16)' };
    if (second === 0 && (c === 0 || c === 2)) return { blocked: true, reason: 'IANA/reserved' };
  }
  if (a === 198 && (second === 18 || second === 19)) return { blocked: true, reason: 'benchmark (198.18/15)' };
  if (a >= 224) return { blocked: true, reason: 'multicast/reserved (>= 224/4)' };
  return { blocked: false };
}

// --- IPv6 -------------------------------------------------------------------

export function parseIPv6(ip: string): string | null {
  // Normalize and return the canonical form; callers compare prefix groups.
  if (ip.includes('.')) {
    // IPv4-mapped IPv6 (::ffff:1.2.3.4) -> decode to IPv4
    const idx = ip.lastIndexOf(':');
    const v4 = parseIPv4(ip.slice(idx + 1));
    if (!v4) return null;
    const prefix = ip.slice(0, idx + 1);
    return `${prefix}${v4[0]}.${v4[1]}.${v4[2]}.${v4[3]}`;
  }
  if (!ip.includes(':')) return null;
  return ip.toLowerCase().replace(/^\[|\]$/g, '');
}

export function ipv6Contains(ip: string, prefix: string): boolean {
  const norm = parseIPv6(ip);
  if (!norm) return false;
  if (norm.startsWith('::ffff:')) {
    const v4 = parseIPv4(norm.slice(7));
    if (v4) {
      const c = checkIPv4(v4);
      if (c.blocked && c.reason !== 'loopback/reserved') return true;
      return false;
    }
  }
  return norm.startsWith(prefix);
}

export function checkIPv6(ip: string): IPCheck {
  const norm = parseIPv6(ip);
  if (!norm) return { blocked: false };
  if (norm === '::' || norm === '::1') return { blocked: true, reason: 'unspecified/loopback' };
  if (ipv6Contains(norm, 'fc') || ipv6Contains(norm, 'fd')) return { blocked: true, reason: 'unique local (fc00/7)' };
  if (ipv6Contains(norm, 'fe8') || ipv6Contains(norm, 'fe9') || ipv6Contains(norm, 'fea') || ipv6Contains(norm, 'feb')) {
    return { blocked: true, reason: 'link-local (fe80/10)' };
  }
  if (ipv6Contains(norm, 'ff')) return { blocked: true, reason: 'multicast (ff00/8)' };
  if (norm.startsWith('64:ff9b:')) return { blocked: false, reason: 'NAT64 well-known prefix' };
  return { blocked: false };
}

export function isBlockedIp(ip: string): IPCheck {
  const v4 = parseIPv4(ip);
  if (v4) return checkIPv4(v4);
  return checkIPv6(ip);
}

export function isProbablyHostname(host: string): boolean {
  return !/^[0-9a-fA-F:.]+$/.test(host) && /[a-z]/i.test(host);
}

/**
 * Validate that a URL is safe to fetch. Blocks:
 *  - non-http(s) schemes
 *  - IP literals in blocked ranges
 *  - hostnames resolving to blocked IPs (via injected resolver)
 * Throws TALError('ssrf_blocked') otherwise.
 */
export async function assertSafeHttpUrl(raw: string, resolve: DNSResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TALError({ code: 'ssrf_blocked', message: `Invalid URL "${raw}"`, details: { raw } });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TALError({
      code: 'ssrf_blocked',
      message: `Protocol "${url.protocol}" is not allowed`,
      details: { raw },
    });
  }
  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
  const literal = !isProbablyHostname(host);
  if (literal) {
    const c = isBlockedIp(host);
    if (c.blocked) {
      throw new TALError({
        code: 'ssrf_blocked',
        message: `Blocked address "${host}" (${c.reason})`,
        details: { raw, host },
      });
    }
    return url;
  }

  const ips = Array.isArray(resolve) ? resolve : await resolve(host);
  const blocked = ips.map((ip) => ({ ip, check: isBlockedIp(ip) })).filter((x) => x.check.blocked);
  if (blocked.length > 0) {
    const first = blocked[0];
    throw new TALError({
      code: 'ssrf_blocked',
      message: `Host "${host}" resolves to blocked address "${first.ip}" (${first.check.reason})`,
      details: { raw, host, ips },
    });
  }
  if (ips.length === 0) {
    throw new TALError({ code: 'network_error', message: `Could not resolve host "${host}"` });
  }
  return url;
}

/**
 * Guard a redirect hop. The next location is resolved and must also be safe.
 * Optionally bound redirects to the same host to prevent rebinding tricks.
 */
export async function assertSafeRedirect(
  nextRaw: string,
  resolve: DNSResolver,
  opts: { allowCrossHost?: boolean; originalHost?: string } = {},
): Promise<URL> {
  const url = await assertSafeHttpUrl(nextRaw, resolve);
  if (!opts.allowCrossHost && opts.originalHost && url.hostname !== opts.originalHost) {
    throw new TALError({
      code: 'ssrf_blocked',
      message: `Redirect to different host "${url.hostname}" blocked`,
      details: { next: nextRaw },
    });
  }
  return url;
}