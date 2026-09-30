import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_HSTS_MAX_AGE,
  PRODUCTION_ORIGIN,
  assertRobots,
  assertSecurityHeaders,
  assertSitemap,
  assertWwwBehavior,
  parseHstsMaxAge,
} from '../scripts/production-smoke.mjs';

function acceptedHeaders(hsts = 'max-age=' + MIN_HSTS_MAX_AGE) {
  return new Headers({
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-test'",
    'strict-transport-security': hsts,
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
}

test('accepted production security headers pass', () => {
  const result = assertSecurityHeaders(acceptedHeaders());
  assert.equal(result.maxAge, MIN_HSTS_MAX_AGE);
});

test('security headers fail closed when HSTS max-age regresses', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=2592000')),
    /HSTS max-age regressed below accepted 6-month Cloudflare baseline/,
  );
});

test('security headers fail closed if includeSubDomains or preload appears without approval', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; includeSubDomains')),
    /includeSubDomains must remain off/,
  );
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; preload')),
    /HSTS preload must remain off/,
  );
});

test('HSTS parser accepts current Cloudflare six-month value', () => {
  assert.equal(parseHstsMaxAge('max-age=15552000'), 15_552_000);
});

test('robots policy preserves search and AI answer visibility while reserving training', () => {
  const robots = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'Sitemap: https://lowcountrydigitalworks.com/sitemap.xml',
  ].join('\n');
  assert.doesNotThrow(() => assertRobots(robots));
});

test('robots policy rejects accidental OAI-SearchBot block', () => {
  const robots = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
    'Allow: /',
    'User-agent: GPTBot',
    'Disallow: /',
    'User-agent: OAI-SearchBot',
    'Disallow: /',
    'Sitemap: https://lowcountrydigitalworks.com/sitemap.xml',
  ].join('\n');
  assert.throws(() => assertRobots(robots), /must not block OAI-SearchBot/);
});

test('sitemap accepts exact canonical locations and rejects Secure Share exposure', () => {
  const required = [
    'https://lowcountrydigitalworks.com/connect/',
    'https://lowcountrydigitalworks.com/guides/',
    'https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/',
    'https://lowcountrydigitalworks.com/guides/website-ownership-handoff/',
    'https://lowcountrydigitalworks.com/services/business-systems-automation/',
    'https://lowcountrydigitalworks.com/work/gas-engine/',
  ];

  const sitemap = locations =>
    '<urlset>' + locations.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';

  assert.doesNotThrow(() => assertSitemap(sitemap(required)));
  assert.throws(
    () => assertSitemap(sitemap([...required, 'https://lowcountrydigitalworks.com/share/'])),
    /Secure Share/,
  );
});

test('sitemap rejects external origins even when an LDW URL appears as a substring', () => {
  const required = [
    'https://lowcountrydigitalworks.com/connect/',
    'https://lowcountrydigitalworks.com/guides/',
    'https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/',
    'https://lowcountrydigitalworks.com/guides/website-ownership-handoff/',
    'https://lowcountrydigitalworks.com/services/business-systems-automation/',
    'https://lowcountrydigitalworks.com/work/gas-engine/',
  ];
  const malicious =
    'https://example.com/?next=https://lowcountrydigitalworks.com/share/';
  const xml =
    '<urlset>' +
    [...required, malicious].map(url => '<url><loc>' + url + '</loc></url>').join('') +
    '</urlset>';

  assert.throws(() => assertSitemap(xml), /canonical production origin/);
});

test('www behavior accepts either apex redirect or canonicalized 200', () => {
  assert.equal(
    assertWwwBehavior({
      status: 301,
      location: PRODUCTION_ORIGIN + '/',
      body: '',
    }),
    'redirect',
  );

  assert.equal(
    assertWwwBehavior({
      status: 200,
      location: null,
      body: '<html><head><link rel="canonical" href="' + PRODUCTION_ORIGIN + '/"></head><body></body></html>',
    }),
    'canonical-200',
  );
});

test('www behavior rejects redirect to an unrelated host', () => {
  assert.throws(
    () => assertWwwBehavior({ status: 302, location: 'https://example.com/', body: '' }),
    /www redirect must target canonical apex origin/,
  );
});
