import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Analytics kit, mode-aware. Run against a build made with the same ANALYTICS_ENABLED value:
//   OFF (default): npm run build && npx playwright test tests/analytics.spec.mjs
//   ON:            ANALYTICS_ENABLED=1 npm run build && ANALYTICS_ENABLED=1 npx playwright test tests/analytics.spec.mjs
// The loader's production-hostname guard means a local 127.0.0.1 run loads NOTHING in either mode. Behaviour with consent is covered by
// tests/analytics-consent.spec.mjs (needs the test-hosts build; see that file).
const ON = process.env.ANALYTICS_ENABLED === '1';
const THIRD_PARTY = /googletagmanager|google-analytics|analytics\.google|clarity\.ms|bing\.com|doubleclick|google\.com\/(?:g|ccm)\//i;
const ENUM = {
  events: ['service_cta_click', 'contact_method_click', 'contact_card_download', 'discovery_handoff_click'],
  placements: ['connect_card', 'connect_actions', 'service_detail', 'mobile_bar', 'footer', 'discovery_hero', 'discovery_bottom', 'home_hero', 'home_cta_band', 'services_hub'],
  methods: { phone: 'tel:', sms: 'sms:', email: 'mailto:' },
  services: ['websites', 'website-care', 'business-systems-automation', 'digital-ownership-platform-administration', 'technology-consulting'],
};

// Event matrix: route -> expected data-ldw anchors (event | method/service | placement), counted from the built HTML.
const MATRIX = {
  '/': ['contact_method_click|sms|home_hero', 'contact_method_click|sms|home_cta_band', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/services/': [
    // R5 polish: one CTA per service card (the phone-only #start-mobile router and its duplicate links are gone)
    ...['websites', 'business-systems-automation', 'digital-ownership-platform-administration', 'technology-consulting'].map((id) => `service_cta_click|${id}|services_hub`),
    'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar',
  ],
  '/services/websites/': ['service_cta_click|websites|service_detail', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  // DEV04 F1: the Website Care page reports its own service id (it reported websites before).
  '/services/website-care/': ['service_cta_click|website-care|service_detail', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/services/business-systems-automation/': ['service_cta_click|business-systems-automation|service_detail', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/services/digital-ownership-platform-administration/': ['service_cta_click|digital-ownership-platform-administration|service_detail', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/services/technology-consulting/': ['service_cta_click|technology-consulting|service_detail', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/connect/': ['contact_card_download||connect_card', 'contact_method_click|sms|connect_actions', 'contact_method_click|phone|connect_actions', 'contact_method_click|email|connect_actions', 'contact_method_click|email|footer', 'contact_method_click|phone|footer'],
  '/contact/': ['contact_method_click|sms|connect_actions', 'contact_method_click|phone|connect_actions', 'contact_method_click|email|connect_actions', 'contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
  '/discovery/': ['discovery_handoff_click||discovery_hero', 'discovery_handoff_click||discovery_bottom', 'contact_method_click|email|footer', 'contact_method_click|phone|footer'],
  '/privacy/': ['contact_method_click|email|footer', 'contact_method_click|phone|footer', 'contact_method_click|sms|mobile_bar', 'contact_method_click|phone|mobile_bar'],
};

function anchors(html) {
  const found = [];
  for (const m of html.matchAll(/<([a-z0-9]+)\b([^>]*\bdata-ldw-event="[^"]*"[^>]*)>/g)) {
    const attrs = Object.fromEntries([...m[2].matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    found.push({ tag: m[1], attrs });
  }
  return found;
}

test.describe('event matrix: inert data attributes on real anchors (emitted only when ANALYTICS_ENABLED=1; an OFF build has none)', () => {
  for (const [route, expected] of Object.entries(MATRIX)) {
    test(route, async ({ request }) => {
      const html = await (await request.get(route)).text();
      const found = anchors(html);
      if (!ON) { expect(found, 'OFF build carries no data-ldw hooks at all').toEqual([]); expect(html).not.toContain('data-ldw-'); return; }
      const keys = found.map(({ attrs }) => [attrs['data-ldw-event'], attrs['data-ldw-method'] ?? attrs['data-ldw-service'] ?? '', attrs['data-ldw-placement']].join('|'));
      const mobile = (k) => k.endsWith('|mobile_bar');
      // The mobile bar is not rendered on /connect/ and /discovery/ by design (existing showMobileContactBar rule).
      expect(keys.sort()).toEqual([...expected].sort());
      for (const { tag, attrs } of found) {
        expect(tag, 'real anchors only, no JS-only buttons').toBe('a');
        expect(attrs.href, 'every event element is a link with a working href').toBeTruthy();
        expect(ENUM.events).toContain(attrs['data-ldw-event']);
        expect(ENUM.placements).toContain(attrs['data-ldw-placement']);
        if (attrs['data-ldw-event'] === 'contact_method_click') expect(attrs.href.toLowerCase().startsWith(ENUM.methods[attrs['data-ldw-method']])).toBe(true);
        if (attrs['data-ldw-event'] === 'service_cta_click') expect(ENUM.services).toContain(attrs['data-ldw-service']);
        if (attrs['data-ldw-event'] === 'contact_card_download') expect(attrs.href).toMatch(/\.vcf(?:[#?]|$)/);
        if (attrs['data-ldw-event'] === 'discovery_handoff_click') expect(new URL(attrs.href).hostname).toBe('getaiform.com');
        expect(Object.keys(attrs).filter((k) => k.startsWith('data-ldw-') && !['data-ldw-event', 'data-ldw-method', 'data-ldw-placement', 'data-ldw-service'].includes(k))).toEqual([]);
      }
      void mobile;
    });
  }
});

test('page markup: no GA/GTM/Clarity IDs, no inline scripts, no iframe or noscript tracker in any mode', async ({ request }) => {
  for (const route of Object.keys(MATRIX).concat(['/share/', '/website-check/'])) {
    const html = await (await request.get(route)).text();
    expect(html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/g) ?? [], route).toEqual([]);
    expect(html, route).not.toMatch(/G-127KLSQHRB|GTM-WZJ8HHKK|zabyszkk6y|googletagmanager|clarity\.ms|<iframe|<noscript/i);
  }
});

test('local run (127.0.0.1) makes zero third-party requests and shows no banner, in either mode', async ({ page }) => {
  const external = [];
  await page.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), (route) => { external.push(route.request().url()); return route.abort(); });
  for (const route of ['/', '/connect/', '/discovery/', '/privacy/', '/share/']) {
    await page.goto(route);
    await page.waitForLoadState('load');
    await page.waitForTimeout(600);
    await expect(page.locator('#ldw-consent')).toHaveCount(0);
    expect(await page.evaluate(() => ({ gtag: typeof window.gtag, dl: typeof window.dataLayer, clarity: typeof window.clarity, ls: window.localStorage.getItem('ldw-consent-v1') }))).toEqual({ gtag: 'undefined', dl: 'undefined', clarity: 'undefined', ls: null });
  }
  expect(external.filter((u) => THIRD_PARTY.test(u))).toEqual([]);
});

test('CSP header and loader assets match the mode', async ({ request }) => {
  const home = await request.get('/');
  const csp = home.headers()['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|frame-src/);
  const loader = await request.get('/ldw-analytics.js');
  const css = await request.get('/ldw-consent.css');
  const html = await home.text();
  if (!ON) {
    expect(csp).not.toMatch(/googletagmanager|google-analytics|analytics\.google|clarity|bing/);
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+';/);
    expect(loader.status()).toBe(404);
    expect(css.status()).toBe(404);
    expect(html).not.toContain('ldw-analytics');
    expect(await (await request.get('/privacy/')).text()).toMatch(/does not intentionally use advertising trackers, behavioral analytics, nonessential cookies/);
  } else {
    expect(csp).toMatch(/script-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/www\.clarity\.ms https:\/\/scripts\.clarity\.ms 'nonce-[^']+'/);
    expect(csp).toMatch(/connect-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com https:\/\/www\.google\.com https:\/\/\*\.clarity\.ms https:\/\/c\.bing\.com/);
    expect(csp).toMatch(/img-src 'self' data: https:\/\/www\.googletagmanager\.com https:\/\/\*\.google-analytics\.com https:\/\/\*\.clarity\.ms https:\/\/c\.bing\.com/);
    expect(loader.status()).toBe(200);
    expect(css.status()).toBe(200);
    expect((html.match(/src="\/ldw-analytics\.js"/g) ?? []).length).toBe(1);
    expect((await (await request.get('/share/')).text())).not.toContain('ldw-analytics');
    const privacy = await (await request.get('/privacy/')).text();
    expect(privacy).toContain('uses analytics and site-experience tools');
    expect(privacy).not.toMatch(/does not intentionally use advertising trackers, behavioral analytics, nonessential cookies/);
    expect(privacy.replace(/<[^>]+>/g, ' ')).not.toMatch(/placeholder|for eddie|\[Eddie|not legal advice|replace before release/i);
  }
});

test('privacy page has no axe violations in this mode', async ({ page }) => {
  await page.goto('/privacy/');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});
