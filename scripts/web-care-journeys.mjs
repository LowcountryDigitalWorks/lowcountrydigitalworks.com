import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  PRODUCTION_ORIGIN,
  assertExpectedStatus,
  assertHtmlPage,
  fetchWithRetry,
} from './production-smoke.mjs';

const EXPECTED_PHONE = 'tel:+18436333123';
const EXPECTED_EMAIL = 'mailto:eddie@lowcountrydigitalworks.com';

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function visibleAnchorText(value) {
  // Journey labels are source-controlled ASCII phrases. We only need to remove
  // nested markup and normalize whitespace; decoding arbitrary HTML entities is
  // unnecessary and can introduce double-unescaping ambiguity.
  return normalizeWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function extractHrefAttribute(attributes) {
  const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/y;
  let offset = 0;

  while (offset < attributes.length) {
    while (/\s/.test(attributes[offset] ?? '')) offset += 1;
    if (offset >= attributes.length) break;

    attributePattern.lastIndex = offset;
    const match = attributePattern.exec(attributes);
    if (!match) return null;

    if (match[1].toLowerCase() === 'href') {
      return match[2] ?? match[3] ?? match[4] ?? null;
    }
    offset = attributePattern.lastIndex;
  }

  return null;
}

export function extractAnchors(html) {
  const anchors = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = extractHrefAttribute(match[1]);
    if (href === null) continue;
    anchors.push({
      href: href.trim(),
      text: visibleAnchorText(match[2]),
    });
  }
  return anchors;
}

export function normalizeJourneyHref(value) {
  const href = value.trim();
  assert.ok(href, 'journey href must not be empty');

  if (/^(?:tel|mailto):/i.test(href)) return href;

  const target = new URL(href, PRODUCTION_ORIGIN);
  assert.equal(
    target.origin,
    PRODUCTION_ORIGIN,
    'journey link escaped accepted production origin: ' + target.origin,
  );
  assert.equal(target.username, '', 'journey links must not contain URL credentials');
  assert.equal(target.password, '', 'journey links must not contain URL credentials');
  return target.href;
}

export function assertJourneyAnchor(
  html,
  { journeyId, labelIncludes, expectedHref },
) {
  const matches = extractAnchors(html).filter(anchor => anchor.text.includes(labelIncludes));
  assert.ok(
    matches.length > 0,
    journeyId + ' must expose at least one anchor containing label: ' + labelIncludes,
  );

  const normalizedExpected = normalizeJourneyHref(expectedHref);
  for (const match of matches) {
    const actualHref = normalizeJourneyHref(match.href);
    assert.equal(
      actualHref,
      normalizedExpected,
      journeyId + ' destination changed unexpectedly',
    );
  }

  return {
    journeyId,
    label: labelIncludes,
    href: normalizedExpected,
  };
}

async function fetchHtml(path) {
  const url = new URL(path, PRODUCTION_ORIGIN);
  const response = await fetchWithRetry(url);
  assertExpectedStatus(response, 200, url, path + ' must return HTTP 200 for journey verification');
  const contentType = response.headers.get('content-type') ?? '';
  assert.ok(
    contentType.toLowerCase().includes('text/html'),
    path + ' must return text/html for journey verification',
  );
  const body = await response.text();
  assertHtmlPage(body, url.href);
  return body;
}

async function writeGithubSummary(results) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;

  const lines = [
    '',
    '## Web Care critical journeys',
    '',
    '- Boundary: GET-only page reads; link destinations are asserted but never followed',
    '',
    '| Journey | Result |',
    '| --- | --- |',
    ...results.map(item => '| ' + item.name + ' | ' + item.detail + ' |'),
    '',
  ];
  await appendFile(target, lines.join('\n'), 'utf8');
}

export async function runWebCareJourneySmoke() {
  const configured = new URL(process.env.PRODUCTION_BASE_URL ?? PRODUCTION_ORIGIN);
  assert.equal(configured.origin, PRODUCTION_ORIGIN, 'journey target origin is fixed to production');
  assert.equal(configured.pathname, '/', 'journey target must use the production origin root');

  const home = await fetchHtml('/');
  const websiteCare = await fetchHtml('/services/website-care/');
  const connect = await fetchHtml('/connect/');

  const results = [];

  assertJourneyAnchor(home, {
    journeyId: 'home-to-discovery',
    labelIncludes: 'Talk through your project',
    expectedHref: '/discovery/',
  });
  results.push({
    name: 'Home → Discovery',
    detail: 'project CTAs route to /discovery/',
  });

  assertJourneyAnchor(websiteCare, {
    journeyId: 'website-care-to-connect',
    labelIncludes: 'Talk through your situation',
    expectedHref: '/connect/',
  });
  results.push({
    name: 'Website Care → Connect',
    detail: 'service CTA routes to /connect/',
  });

  assertJourneyAnchor(connect, {
    journeyId: 'connect-call',
    labelIncludes: 'Call Eddie',
    expectedHref: EXPECTED_PHONE,
  });
  assertJourneyAnchor(connect, {
    journeyId: 'connect-email',
    labelIncludes: 'Email Eddie',
    expectedHref: EXPECTED_EMAIL,
  });
  results.push({
    name: 'Connect contact actions',
    detail: 'accepted call + email destinations are present; neither is followed',
  });

  await writeGithubSummary(results);
  return results;
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  runWebCareJourneySmoke()
    .then(results => {
      for (const result of results) {
        console.log('[PASS] ' + result.name + ' — ' + result.detail);
      }
      console.log('Web Care critical-journey smoke passed: ' + results.length + ' journeys.');
    })
    .catch(error => {
      console.error('[FAIL] Web Care critical-journey smoke failed.');
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
