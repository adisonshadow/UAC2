/**
 * 出站外呼 SSRF 防护。
 * 拦截：非 http(s) 协议、解析到私网/回环/链路本地/唯一本地/组播/保留段的地址、云 metadata 端点。
 * 对每次跳转（含手动跟随的重定向）逐跳校验。
 */
const dns = require('dns').promises;
const net = require('net');

/** IPv4 私有/保留段（CIDR） */
const BLOCKED_V4_CIDRS = [
  '0.0.0.0/8', // 本网络
  '10.0.0.0/8', // RFC1918
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // 回环
  '169.254.0.0/16', // 链路本地（含 169.254.169.254 metadata）
  '172.16.0.0/12', // RFC1918
  '192.0.0.0/24', // IETF 协议分配
  '192.0.2.0/24', // TEST-NET-1
  '192.88.99.0/24',
  '192.168.0.0/16', // RFC1918
  '198.18.0.0/15',
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // 组播
  '240.0.0.0/4', // 保留
];

function ipToLong(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts.reduce((acc, n) => (acc << 8) + n, 0) >>> 0;
}

function cidrContains(cidr, ipLong) {
  const [base, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  const baseLong = ipToLong(base);
  if (baseLong === null || ipLong === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (baseLong & mask) === (ipLong & mask);
}

function isBlockedIpv4(ip) {
  const ipLong = ipToLong(ip);
  if (ipLong === null) return true;
  return BLOCKED_V4_CIDRS.some((cidr) => cidrContains(cidr, ipLong));
}

function isBlockedIpv6(ip) {
  const normalized = String(ip).toLowerCase();
  if (normalized === '::' || normalized === '::1') return true; // 未指定/回环
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9')
    || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // 链路本地 fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // 唯一本地 fc00::/7
  if (normalized.startsWith('ff')) return true; // 组播 ff00::/8
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped：按内嵌 IPv4 判定
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) return isBlockedIpv4(v4);
  }
  return false;
}

function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // 非 IP 字面量一律拒绝
}

/**
 * 校验单个 URL：协议 http(s)、主机名解析后逐地址检查。
 * 解析失败同样拒绝（防 DNS 异常绕过）。
 */
async function assertSafeOutboundUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error(`外呼 URL 无效: ${url}`), { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error(`外呼仅允许 http/https 协议: ${parsed.protocol}`), { status: 400 });
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // [::1] → ::1
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw Object.assign(new Error(`外呼目标地址被 SSRF 防护拦截: ${hostname}`), { status: 400 });
    }
    return;
  }

  let addresses;
  try {
    const result = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = result.map((r) => r.address);
  } catch {
    throw Object.assign(new Error(`外呼域名解析失败: ${hostname}`), { status: 400 });
  }
  if (!addresses.length || addresses.some((addr) => isBlockedIp(addr))) {
    throw Object.assign(new Error(`外呼目标域名解析到内网/保留地址，已被拦截: ${hostname}`), { status: 400 });
  }
}

module.exports = {
  assertSafeOutboundUrl,
  isBlockedIp,
};
