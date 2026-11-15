/**
 * Stage 1.5 offline-only prospect intake contract. No fetch, DNS, persistence,
 * email delivery, or runtime authorization. The public Website Check route does
 * NOT import this module; public scanning remains separately gated by #94.
 */
const MAX_WEBSITE_INPUT_LENGTH = 320;
const MAX_EMAIL_INPUT_LENGTH = 254;
const RESERVED_SUFFIXES = new Set([
  'localhost', 'local', 'internal', 'invalid', 'test', 'example',
  'onion', 'arpa',
]);
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_{}|~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_{}|~-]+)*$/;

export class ProspectIntakeError extends Error {
  constructor() {
    // Never echo visitor-provided URLs or email addresses in errors/logs.
    super('The requested prospect input is not eligible for this offline preview.');
    this.name = 'ProspectIntakeError';
  }
}

function fail() {
  throw new ProspectIntakeError();
}

// Syntax-only checks. DNS, public-IP proof, redirects, egress and target authority
// cannot be determined without a separately accepted network execution design.
function validPublicLookingHost(hostname) {
  if (typeof hostname !== 'string' || hostname.length > 253 || !hostname) return false;
  const parts = hostname.split('.');
  if (parts.length < 2 || parts.some((part) => part.length > 63 || !DOMAIN_LABEL.test(part))) return false;
  if (parts.some((part) => part.startsWith('xn--'))) return false; // IDNA policy deferred.
  const suffix = parts.at(-1);
  if (RESERVED_SUFFIXES.has(suffix) || !/^[a-z]{2,63}$/.test(suffix)) return false;
  return true;
}

/**
 * Validates only the visitor's *display candidate*, NEVER a fetch destination.
 * Accepts one bare DNS host or canonical HTTPS home-origin URL with optional /.
 * Paths, queries, ports, IP literals, userinfo and internationalized names are
 * intentionally out of scope for the first fail-closed prototype.
 */
export function normalizeProspectDisplayOrigin(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_WEBSITE_INPUT_LENGTH) fail();
  if (/[\u0000-\u001f\u007f]/.test(input)) fail();
  const value = input.trim();
  if (!value || /[^\x21-\x7e]/.test(value) || /[\\@%?#\[\]]/.test(value)) fail();
  if (value.startsWith('/') || value.startsWith('.')) fail();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https:\/\//i.test(value)) fail();
  if (!hasScheme && value.includes('/')) fail();

  const candidate = hasScheme ? value : 'https://' + value;
  const rawAuthority = candidate.slice('https://'.length).split('/')[0];
  // Any explicit port, even :443, or other authority metacharacter fails.
  if (!rawAuthority || /[:@\\]/.test(rawAuthority)) fail();

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    fail();
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password
      || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash
      || !validPublicLookingHost(parsed.hostname)
      || parsed.hostname.endsWith('.')) fail();

  return Object.freeze({
    kind: 'ldw.prospect-display-target.v0',
    displayOrigin: parsed.origin,
    hostname: parsed.hostname,
    // These flags are deliberately false and MUST NOT be used as fetch permits.
    scanAuthorized: false,
    networkAuthorized: false,
  });
}

/**
 * Validates only the shape of an optional requested-email-report intent.
 * It deliberately does not return the submitted email address or authorize
 * storage, delivery, marketing, contact enrichment or network operations.
 */
export function inspectRequestedReportEmailIntent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.getPrototypeOf(input) !== Object.prototype) fail();
  const allowed = new Set(['email', 'reportRequested', 'marketingOptIn']);
  if (Object.keys(input).some((key) => !allowed.has(key))) fail();
  if (input.reportRequested !== true) fail();
  if (input.marketingOptIn !== undefined && typeof input.marketingOptIn !== 'boolean') fail();
  if (typeof input.email !== 'string' || !input.email
      || input.email.length > MAX_EMAIL_INPUT_LENGTH) fail();
  if (/[\u0000-\u001f\u007f]/.test(input.email) || /[^\x20-\x7e]/.test(input.email)) fail();
  const address = input.email.trim();
  if (!address || address.length > MAX_EMAIL_INPUT_LENGTH) fail();
  const components = address.split('@');
  if (components.length !== 2) fail();
  const [local, domainRaw] = components;
  if (!local || local.length > 64 || !EMAIL_LOCAL.test(local)) fail();
  const domain = domainRaw.toLowerCase();
  if (!validPublicLookingHost(domain)) fail();

  // Intent is not delivery. No personally identifying email is returned.
  return Object.freeze({
    kind: 'ldw.prospect-report-email-intent.v0',
    reportRequested: true,
    emailFormat: 'valid',
    marketingOptIn: input.marketingOptIn === true,
    emailRetained: false,
    emailDeliveryAuthorized: false,
  });
}
