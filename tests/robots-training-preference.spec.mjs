import { test, expect } from '@playwright/test';

// Microsoft begins honoring this publisher-use preference as pages are recrawled
// from February 2027. This is a source/readback contract, not proof of enforcement.
test('published robots preserves search and grounding while disallowing AI model training', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain\b/i);

  const robots = await response.text();
  expect(robots).toMatch(/^User-agent: \*\r?\nContent-Signal: search=yes, ai-input=yes, ai-train=no, use=reference\r?\nAllow: \/$/m);
  expect(robots).toMatch(/^User-agent: GPTBot\r?\nDisallow: \/$/m);
  expect(robots).toMatch(/^User-agent: __usage_ai-training\r?\nDisallow: \/$/m);
  expect(robots.match(/^User-agent: __usage_ai-training$/gm)).toHaveLength(1);
  expect(robots).toContain('Sitemap: https://lowcountrydigitalworks.com/sitemap.xml');

  // This is a use preference, NOT a Bingbot/Googlebot crawl block or grounding opt-out.
  expect(robots).not.toMatch(/^User-agent: (?:Bingbot|Googlebot|OAI-SearchBot|Google-Extended)\r?\nDisallow:/m);
  expect(robots).not.toMatch(/ai-grounding\s*:\s*(?:disallow|disallowextended)/i);
});

test('the use preference is an independent robots group, not a blanket disallow on wildcard search', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBeTruthy();
  const robots = await response.text();
  const wildcard = robots.match(/^User-agent: \*\r?\n([\s\S]*?)(?=^User-agent: |^Sitemap:|$(?![\s\S]))/m);
  expect(wildcard).not.toBeNull();
  expect(wildcard?.[1]).toContain('Allow: /');
  expect(wildcard?.[1]).not.toContain('Disallow: /');
  expect(robots).toMatch(/\r?\nUser-agent: __usage_ai-training\r?\nDisallow: \/\r?\n/);
});
