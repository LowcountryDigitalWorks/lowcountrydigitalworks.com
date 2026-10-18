import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const productionPages = path.resolve('dist');

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : [];
  }));
  return nested.flat();
}

test('built production pages and components contain no inline style attributes', async () => {
  const files = await htmlFiles(productionPages);
  expect(files.length).toBeGreaterThan(0);

  const violations = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (/<[a-z][^>]*\sstyle\s*=/i.test(html)) violations.push(path.relative(productionPages, file));
  }

  expect(violations).toEqual([]);
});

test('workers.dev noindex header stays attached to its host rule', async () => {
  const headerRules = await readFile(path.resolve('public/_headers'), 'utf8');
  expect(headerRules).toMatch(/https:\/\/\*\.workers\.dev\/\*\r?\n\s+X-Robots-Tag: noindex, nofollow\r?\n\r?\n\/share\/\*/);
  expect(headerRules.match(/X-Robots-Tag: noindex, nofollow/g) ?? []).toHaveLength(3);
});

test('Cloudflare asset responses preserve strict security headers and apply noindex only to private utility routes', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("style-src 'self'");
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['x-frame-options']).toBe('DENY');

  for (const route of ['/share/', '/discovery/']) {
    const privateResponse = await request.get(route);
    expect(privateResponse.status(), route).toBe(200);
    expect(privateResponse.headers()['x-robots-tag'], route).toMatch(/noindex\s*,\s*nofollow/i);
  }

  const publicResponse = await request.get('/services/websites/');
  expect(publicResponse.status()).toBe(200);
  expect(publicResponse.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/i);
});

test('unknown public routes return a real branded 404', async ({ request }) => {
  const response = await request.get('/this-route-does-not-exist-hardening-check/');
  expect(response.status()).toBe(404);
  const html = await response.text();
  expect(html).toContain('<h1>That page is not here.</h1>');
  expect(html).toContain('href="/"');
});

test('security.txt is standards-shaped and exposes only accepted public reporting details', async ({ request }) => {
  const response = await request.get('/.well-known/security.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/text\/plain/i);
  const body = await response.text();
  expect(body).toContain('Contact: mailto:eddie@lowcountrydigitalworks.com');
  expect(body).toContain('Canonical: https://lowcountrydigitalworks.com/.well-known/security.txt');
  expect(body).toContain('Policy: https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/blob/main/SECURITY.md');
  expect(body).not.toMatch(/bounty|SLA|safe.harbor|street|address/i);
});
