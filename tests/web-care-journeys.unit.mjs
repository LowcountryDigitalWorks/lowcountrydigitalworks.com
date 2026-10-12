import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertJourneyAnchor,
  extractAnchors,
  normalizeJourneyHref,
} from '../scripts/web-care-journeys.mjs';

test('extractAnchors preserves hrefs and normalizes nested visible text', () => {
  const html = '<a class="button" href="/connect/"><span>Talk</span> through   your project</a>';
  assert.deepEqual(extractAnchors(html), [
    { href: '/connect/', text: 'Talk through your project' },
  ]);
});

test('same-origin journey anchor passes with a relative destination', () => {
  const result = assertJourneyAnchor(
    '<a href="/connect/">Talk through your project</a>',
    {
      journeyId: 'home-to-connect',
      labelIncludes: 'Talk through your project',
      expectedHref: '/connect/',
    },
  );

  assert.equal(result.href, 'https://lowcountrydigitalworks.com/connect/');
});

test('journey anchor fails closed when the named action disappears', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="/connect/">Different action</a>',
      {
        journeyId: 'home-to-connect',
        labelIncludes: 'Talk through your project',
        expectedHref: '/connect/',
      },
    ),
    /must expose exactly one anchor/,
  );
});

test('journey anchor fails closed when the named action routes elsewhere', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="/services/">Talk through your project</a>',
      {
        journeyId: 'home-to-connect',
        labelIncludes: 'Talk through your project',
        expectedHref: '/connect/',
      },
    ),
    /destination changed unexpectedly/,
  );
});

test('journey anchor rejects an external web destination before comparison', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="https://example.com/connect/">Talk through your project</a>',
      {
        journeyId: 'home-to-connect',
        labelIncludes: 'Talk through your project',
        expectedHref: '/connect/',
      },
    ),
    /escaped accepted production origin/,
  );
});

test('accepted telephone and email destinations are compared without following them', () => {
  const html = [
    '<a href="tel:+18436333123"><span>Call Eddie</span><strong>843-633-3123</strong></a>',
    '<a href="mailto:eddie@lowcountrydigitalworks.com"><span>Email Eddie</span></a>',
  ].join('');

  assert.doesNotThrow(() => assertJourneyAnchor(html, {
    journeyId: 'connect-call',
    labelIncludes: 'Call Eddie',
    expectedHref: 'tel:+18436333123',
  }));
  assert.doesNotThrow(() => assertJourneyAnchor(html, {
    journeyId: 'connect-email',
    labelIncludes: 'Email Eddie',
    expectedHref: 'mailto:eddie@lowcountrydigitalworks.com',
  }));
});

test('same-origin absolute URLs normalize to the accepted production identity', () => {
  assert.equal(
    normalizeJourneyHref('https://lowcountrydigitalworks.com/connect/'),
    'https://lowcountrydigitalworks.com/connect/',
  );
});
