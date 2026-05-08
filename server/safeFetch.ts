// SSRF defense for any user-supplied URL we fetch server-side.
//
// Without this, /api/sources/url and the URL connector could be coerced
// into pulling http://169.254.169.254/  (AWS metadata) → leaking creds,
// http://localhost:6379  (Redis) → executing internal commands,
// file:///etc/passwd, etc. The block:
//
//   1. Reject non-http(s) schemes (file:, javascript:, data:, gopher:, …)
//   2. Resolve the hostname; reject any private / link-local / loopback IP.
//   3. Track redirects manually so a public URL can't 302 to localhost.
//
// Set BYOR_SSRF_ALLOW_PRIVATE=1 to bypass for trusted local-only deploys
// (e.g. running BYOR + the URL targets all on the same laptop).

import { promises as dns } from "node:dns";

const ALLOW_PRIVATE = process.env.BYOR_SSRF_ALLOW_PRIVATE === "1";

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return null;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return null;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

// Check whether `n` (unsigned 32-bit IPv4) sits inside the CIDR `network/mask`.
// JS bitwise ops yield signed 32-bit results, so `>>> 0` normalises both
// sides to unsigned before comparing. Without that, masks like 0xffff0000
// turn negative and quietly fail to match. (169.254.169.254 was the canary.)
function inSubnet(n: number, network: number, mask: number): boolean {
  return ((n & mask) >>> 0) === ((network & mask) >>> 0);
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return (
    inSubnet(n, 0x00000000, 0xff000000) || // 0.0.0.0/8 (this network)
    inSubnet(n, 0x0a000000, 0xff000000) || // 10.0.0.0/8
    inSubnet(n, 0x64400000, 0xffc00000) || // 100.64.0.0/10 CGN
    inSubnet(n, 0x7f000000, 0xff000000) || // 127.0.0.0/8 loopback
    inSubnet(n, 0xa9fe0000, 0xffff0000) || // 169.254.0.0/16 link-local (incl. AWS metadata)
    inSubnet(n, 0xac100000, 0xfff00000) || // 172.16.0.0/12
    inSubnet(n, 0xc0a80000, 0xffff0000) || // 192.168.0.0/16
    inSubnet(n, 0xc0000000, 0xffffff00) || // 192.0.0.0/24 IETF
    inSubnet(n, 0xc0000200, 0xffffff00) || // 192.0.2.0/24 TEST-NET-1
    inSubnet(n, 0xc6120000, 0xfffe0000) || // 198.18.0.0/15 benchmark
    inSubnet(n, 0xc6336400, 0xffffff00) || // 198.51.100.0/24 TEST-NET-2
    inSubnet(n, 0xcb007100, 0xffffff00) || // 203.0.113.0/24 TEST-NET-3
    inSubnet(n, 0xe0000000, 0xe0000000)    // 224.0.0.0/3 multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  if (lower.startsWith("ff")) return true; // multicast
  return false;
}

async function ipsForHost(host: string): Promise<string[]> {
  // Already a literal? skip DNS.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return [host];
  if (host.includes(":")) return [host.replace(/[\[\]]/g, "")];
  try {
    const records = await dns.lookup(host, { all: true });
    return records.map((r) => r.address);
  } catch {
    return [];
  }
}

async function assertPublicHost(host: string): Promise<void> {
  if (ALLOW_PRIVATE) return;
  const ips = await ipsForHost(host);
  if (ips.length === 0) {
    throw new Error(`unable to resolve host: ${host}`);
  }
  for (const ip of ips) {
    const isPrivate =
      ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
    if (isPrivate) {
      throw new Error(`blocked private/link-local address: ${ip}`);
    }
  }
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;

export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let target = rawUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw new Error(`invalid URL: ${target}`);
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new Error(`scheme not allowed: ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    // Drive redirects manually so we re-validate the next host before fetching it.
    const res = await fetch(target, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return res; // weird but ok
      target = new URL(next, target).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}
