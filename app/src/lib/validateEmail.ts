import dns from "dns";

// Pragmatic RFC 5322-lite check: catches the vast majority of typos/garbage
// ("abc", "a@b", "test@test") without the false-positive risk of a stricter
// pattern that trips on real (if unusual) addresses. Confirms the email is
// well-formed — not, on its own, that it's a real, deliverable inbox.
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT_RE.test(email.trim());
}

// dns.promises.resolveMx() (and Node's DNS functions in general) normally
// use whatever nameserver the OS network config hands them. On some Windows
// networks — a school/office network, a VPN, certain routers — that
// nameserver setup is broken for Node's direct queries even though normal
// browsing works fine: we saw `ECONNREFUSED` querying MX records for a
// perfectly ordinary domain, meaning Node tried to talk to a DNS server that
// actively refused the connection. Pointing a dedicated Resolver at known-
// good public DNS servers sidesteps whatever is misconfigured in the local
/// VPN-pushed nameserver list, and does NOT mutate the process-wide
// dns.setServers() (which would affect unrelated code elsewhere in the app).
const resolver = new dns.promises.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

// Only these mean "the resolver answered and there is definitively no MX
// record" — every other error (ECONNREFUSED, ETIMEOUT, ESERVFAIL, …) means
// the query itself failed, not that the domain lacks one, and must fail
// open rather than reject a real address.
const NO_RECORD_CODES = new Set(["ENOTFOUND", "ENODATA"]);

/**
 * Confirms the email's domain has an MX record — i.e. is actually set up to
 * receive mail — which is what catches "abc@abd.com": abd.com is a real,
 * registered domain (it resolves to a real IP, it's just a parked page with
 * no mail server behind it), so a plain "does this domain exist at all"
 * check would wrongly pass it. Checking MX specifically is the correct
 * signal here: it's what nearly every real mail-accepting domain has, and
 * what a parked/placeholder domain doesn't.
 *
 * (RFC 5321 §5.1 technically allows mail to fall back to a domain's plain
 * A/AAAA record when no MX exists, but that's a legacy allowance almost no
 * real domain relies on today — falling back to it here would let exactly
 * the abd.com case back in, since parked domains almost always still have
 * an A record. So a definitive "no MX" is treated as non-deliverable
 * outright, no A-record fallback.)
 *
 * Can't confirm the specific mailbox exists (that needs an SMTP handshake
 * or a paid verification service) — only that the domain is deliverable in
 * principle. Fails OPEN (returns true) on anything inconclusive — a DNS
 * timeout, a blocked/misbehaving resolver, etc. — since a booking should
 * never be blocked by network trouble, and a bad address slipping through
 * is harmless (the mailer is fail-soft and the booking itself never depends
 * on email).
 */
export async function hasDeliverableEmailDomain(email: string, timeoutMs = 4000): Promise<boolean> {
  const domain = email.trim().split("@")[1];
  if (!domain) return false;

  const withTimeout = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);

  try {
    const mxRecords = await withTimeout(resolver.resolveMx(domain));
    if (mxRecords === null) return true; // timed out — inconclusive, fail open
    return mxRecords.length > 0;
  } catch (err: any) {
    if (NO_RECORD_CODES.has(err?.code)) return false; // definitively no MX record
    console.warn(`[validateEmail] resolveMx(${domain}) inconclusive: code=${err?.code} message=${err?.message}`);
    return true; // query itself failed — fail open
  }
}
