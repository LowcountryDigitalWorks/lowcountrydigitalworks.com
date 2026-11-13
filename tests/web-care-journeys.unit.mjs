import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertJourneyAnchor,
  extractAnchors,
  normalizeJourneyHref,
} from '../scripts/web-care-journeys.mjs';

test('extractAnchors preserves hrefs and normalizes nested visible text', () => {
  const html = '<a class="button" href="/discovery/"><span>Talk</span> through   your project</a>';
  assert.deepEqual(extractAnchors(html), [
    { href: '/discovery/', text: 'Talk through your project' },
  ]);
});

test('extractAnchors does not decode arbitrary HTML entities in journey labels', () => {
  const html = '<a href="/discovery/">Talk &amp;amp; learn</a>';
  assert.deepEqual(extractAnchors(html), [
    { href: '/discovery/', text: 'Talk &amp;amp; learn' },
  ]);
});

test('same-origin journey anchor passes with the accepted Home discovery destination', () => {
  const result = assertJourneyAnchor(
    '<a href="/discovery/">Talk through your project</a>',
    {
      journeyId: 'home-to-discovery',
      labelIncludes: 'Talk through your project',
      expectedHref: '/discovery/',
    },
  );

  assert.equal(result.href, 'https://lowcountrydigitalworks.com/discovery/');
});

test('duplicate named journey anchors pass when every match uses the accepted destination', () => {
  const html = [
    '<a class="hero" href="/discovery/">Talk through your project</a>',
    '<a class="final-cta" href="https://lowcountrydigitalworks.com/discovery/">Talk through your project</a>',
  ].join('');

  assert.doesNotThrow(() => assertJourneyAnchor(html, {
    journeyId: 'home-to-discovery',
    labelIncludes: 'Talk through your project',
    expectedHref: '/discovery/',
  }));
});

test('duplicate named journey anchors fail closed if any match routes elsewhere', () => {
  const html = [
    '<a href="/discovery/">Talk through your project</a>',
    '<a href="/services/">Talk through your project</a>',
  ].join('');

  assert.throws(
    () => assertJourneyAnchor(html, {
      journeyId: 'home-to-discovery',
      labelIncludes: 'Talk through your project',
      expectedHref: '/discovery/',
    }),
    /destination changed unexpectedly/,
  );
});

test('journey anchor fails closed when the named action disappears', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="/discovery/">Different action</a>',
      {
        journeyId: 'home-to-discovery',
        labelIncludes: 'Talk through your project',
        expectedHref: '/discovery/',
      },
    ),
    /must expose at least one anchor/,
  );
});

test('journey anchor fails closed when the named action routes elsewhere', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="/services/">Talk through your project</a>',
      {
        journeyId: 'home-to-discovery',
        labelIncludes: 'Talk through your project',
        expectedHref: '/discovery/',
      },
    ),
    /destination changed unexpectedly/,
  );
});

test('journey anchor rejects an external web destination before comparison', () => {
  assert.throws(
    () => assertJourneyAnchor(
      '<a href="https://example.com/discovery/">Talk through your project</a>',
      {
        journeyId: 'home-to-discovery',
        labelIncludes: 'Talk through your project',
        expectedHref: '/discovery/',
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

test('extractAnchors ignores data-href and asserts the real href', () => {
  const html = '<a data-href="/discovery/" href="/wrong/">Talk through your project</a>';
  assert.deepEqual(extractAnchors(html), [
    { href: '/wrong/', text: 'Talk through your project' },
  ]);
  assert.throws(
    () => assertJourneyAnchor(html, {
      journeyId: 'home-to-discovery',
      labelIncludes: 'Talk through your project',
      expectedHref: '/discovery/',
    }),
    /destination changed unexpectedly/,
  );
  assert.deepEqual(
    extractAnchors('<a data-href="/discovery/">Talk through your project</a>'),
    [],
  );
});

test('extractAnchors does not match href text inside another quoted attribute', () => {
  const html = '<a title="copy href=\'/discovery/\'" href="/wrong/">Talk through your project</a>';
  assert.deepEqual(extractAnchors(html), [
    { href: '/wrong/', text: 'Talk through your project' },
  ]);
  assert.throws(
    () => assertJourneyAnchor(html, {
      journeyId: 'home-to-discovery',
      labelIncludes: 'Talk through your project',
      expectedHref: '/discovery/',
    }),
    /destination changed unexpectedly/,
  );
});
