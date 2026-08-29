const SCRIPT_SRC = /(^|;)([\t ]*script-src[\t ]+)([^;]*)(?=;|$)/gi;
const CSP_NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;
const SECURE_SHARE_PATH = '/share/continue';
const SECURE_SHARE_HOST = 'share.lowcountrydigitalworks.com';
const SECURE_SHARE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, noarchive',
  'X-Content-Type-Options': 'nosniff',
};

export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function addNonceToCsp(policy, nonce) {
  if (typeof policy !== 'string' || !CSP_NONCE.test(nonce)) {
    return null;
  }

  const matches = [...policy.matchAll(SCRIPT_SRC)];
  if (matches.length !== 1) {
    return null;
  }

  const match = matches[0];
  const sources = match[3];
  if (!sources.trim() || /(^|[\t ])'nonce-[^']+'(?=[\t ]|$)/i.test(sources)) {
    return null;
  }

  const trailingWhitespace = sources.match(/[\t ]*$/)[0];
  const insertionPoint = match.index + match[0].length - trailingWhitespace.length;

  return `${policy.slice(0, insertionPoint)} 'nonce-${nonce}'${policy.slice(insertionPoint)}`;
}

export function validateSecureShareDestination(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  let destination;
  try {
    destination = new URL(value);
  } catch {
    return null;
  }

  if (
    destination.protocol !== 'https:' ||
    destination.hostname !== SECURE_SHARE_HOST ||
    destination.username ||
    destination.password ||
    destination.port
  ) {
    return null;
  }

  return destination.href;
}

function secureShareTransition(request, env) {
  const method = request.method.toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    return new Response(method === 'HEAD' ? null : 'Method not allowed.', {
      status: 405,
      headers: {
        ...SECURE_SHARE_RESPONSE_HEADERS,
        Allow: 'GET, HEAD',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const destination = validateSecureShareDestination(env.SECURE_SHARE_DESTINATION_URL);
  if (destination === null) {
    return new Response(
      method === 'HEAD' ? null : 'Secure Share is temporarily unavailable. Please contact Lowcountry Digital Works.',
      {
        status: 503,
        headers: {
          ...SECURE_SHARE_RESPONSE_HEADERS,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...SECURE_SHARE_RESPONSE_HEADERS,
      Location: destination,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === SECURE_SHARE_PATH) {
      return secureShareTransition(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();

    if (contentType !== 'text/html') {
      return response;
    }

    const policy = response.headers.get('Content-Security-Policy');
    const policyWithNonce = addNonceToCsp(policy, createNonce());

    if (policyWithNonce === null) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', policyWithNonce);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
