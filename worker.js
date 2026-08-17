const SCRIPT_SRC = /(^|;)([\t ]*script-src[\t ]+)([^;]*)(?=;|$)/gi;
const CSP_NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

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

export default {
  async fetch(request, env) {
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
