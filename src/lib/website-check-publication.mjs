/**
 * Website Check Stage 1 publication-only projection.
 *
 * This validates a manually cleared LDW-owned, precomputed presentation
 * fixture at build time. It does not parse WQT/Engine provider schemas, infer
 * evidence semantics, collect sites, or authorize data publication.
 */
const TOP_LEVEL = [
  'publicationMode', 'label', 'checkIntent', 'fixtureState', 'source',
  'evidenceCycle', 'freshness', 'coverage', 'claimBoundary',
  'finding', 'residual', 'notMeasured',
];
const FINDING = [
  'id', 'category', 'title', 'summary', 'meaning', 'action',
  'verification', 'owner', 'comparisonBasis', 'beforeCount', 'afterCount', 'recheck',
];
const RESIDUAL = ['id', 'category', 'title', 'status', 'owner', 'summary', 'limitation'];

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(record, required) {
  if (!isPlainRecord(record)) throw new TypeError('Invalid Website Check publication record');
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== required.length || required.some((key) => !Object.hasOwn(descriptors, key))) {
    throw new TypeError('Unexpected or missing Website Check publication fields');
  }
  if (keys.some((key) => typeof key !== 'string' || !required.includes(key) ||
    !Object.hasOwn(descriptors[key], 'value'))) {
    throw new TypeError('Unsupported Website Check publication field');
  }
}

// The Stage 1 publication fixture is manually approved narrative, never a URL,
// contact point, markup fragment, or arbitrary provider string. Restrict the
// allowable alphabet rather than trying to blacklist every Unicode spoofing
// character or new URL scheme. New language/punctuation requires explicit review.
const PUBLIC_NARRATIVE = /^[A-Za-z0-9][A-Za-z0-9 .,;:?!()&/'\u2013\u2014-]*$/u;
const LINK_OR_HOST_HINT = /(?:\b(?:https?|ftp|file|data|javascript|vbscript|mailto):|\bwww\.|\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b)/iu;

function publicText(value, maxLength = 600) {
  if (typeof value !== 'string' || value.length === 0 ||
    value.length > maxLength || value.trim() !== value ||
    !PUBLIC_NARRATIVE.test(value) || LINK_OR_HOST_HINT.test(value)) {
    throw new TypeError('Invalid Website Check publication text');
  }
  return value;
}

function publicId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,79})$/u.test(value)) {
    throw new TypeError('Invalid Website Check evidence identifier');
  }
  return value;
}

function observedCount(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000) {
    throw new TypeError('Invalid observed Website Check finding count');
  }
  return value;
}

function projectFinding(value) {
  exactFields(value, FINDING);
  if (value.comparisonBasis !== 'accepted_same_source_remeasurement') {
    throw new TypeError('Website Check comparison lacks an accepted same-source basis');
  }
  const id = publicId(value.id);
  const beforeCount = observedCount(value.beforeCount);
  const afterCount = observedCount(value.afterCount);
  // This fixed historical publication explicitly claims an observed reduction.
  // Changed/increased counts require a separately reviewed publication narrative.
  if (afterCount >= beforeCount) {
    throw new TypeError('Website Check finding no longer supports the reduction claim');
  }
  const recheck = publicText(value.recheck);
  const expectedRecheck = `Same-source remeasurement observed ${afterCount} remaining ${id} ${afterCount === 1 ? 'finding' : 'findings'}.`;
  if (recheck !== expectedRecheck) {
    throw new TypeError('Website Check recheck text disagrees with the observed count');
  }
  return Object.freeze({
    id,
    category: publicText(value.category, 120),
    title: publicText(value.title, 160),
    summary: publicText(value.summary),
    meaning: publicText(value.meaning, 1000),
    action: publicText(value.action, 1000),
    verification: publicText(value.verification, 1000),
    owner: publicText(value.owner, 120),
    comparisonBasis: value.comparisonBasis,
    beforeCount,
    afterCount,
    recheck,
  });
}

function projectResidual(value) {
  exactFields(value, RESIDUAL);
  if (value.status !== 'MONITOR / NO ACTION') {
    throw new TypeError('Unknown Website Check residual decision state');
  }
  return Object.freeze({
    id: publicId(value.id),
    category: publicText(value.category, 120),
    title: publicText(value.title, 160),
    status: value.status,
    owner: publicText(value.owner, 120),
    summary: publicText(value.summary),
    limitation: publicText(value.limitation, 1000),
  });
}

/**
 * Fail closed before static publication. No generic provider payloads:
 * callers must supply a separately approved, already sanitized public fixture.
 */
export function projectPublicationSafeWebsiteCheck(raw) {
  exactFields(raw, TOP_LEVEL);
  if (raw.publicationMode !== 'ldw-owned-precomputed') {
    throw new TypeError('Website Check only accepts precomputed LDW-owned publication evidence');
  }
  if (!Array.isArray(raw.notMeasured) || raw.notMeasured.length < 1 || raw.notMeasured.length > 12) {
    throw new TypeError('Website Check requires explicit unmeasured coverage');
  }
  // Do not trigger accessor side effects on a supplied array or silently strip
  // extra array properties; this is a publication gate, not a provider parser.
  if (Object.getPrototypeOf(raw.notMeasured) !== Array.prototype) {
    throw new TypeError('Invalid Website Check coverage list prototype');
  }
  const coverageDescriptors = Object.getOwnPropertyDescriptors(raw.notMeasured);
  const coverageKeys = Reflect.ownKeys(coverageDescriptors);
  if (coverageKeys.length !== raw.notMeasured.length + 1 ||
    coverageKeys.some((key) => key !== 'length' &&
      (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= raw.notMeasured.length ||
        !Object.hasOwn(coverageDescriptors[key], 'value')))) {
    throw new TypeError('Invalid Website Check coverage list elements');
  }
  const notMeasured = Array.from({ length: raw.notMeasured.length },
    (_, index) => publicText(coverageDescriptors[String(index)].value, 160));
  if (new Set(notMeasured).size !== notMeasured.length) {
    throw new TypeError('Duplicate Website Check unmeasured coverage');
  }
  const finding = projectFinding(raw.finding);
  const residual = projectResidual(raw.residual);
  if (finding.id === residual.id) throw new TypeError('Duplicate Website Check evidence identifiers');

  return Object.freeze({
    publicationMode: raw.publicationMode,
    label: publicText(raw.label, 120),
    checkIntent: publicText(raw.checkIntent, 240),
    fixtureState: publicText(raw.fixtureState, 120),
    source: publicText(raw.source, 240),
    evidenceCycle: publicText(raw.evidenceCycle, 240),
    freshness: publicText(raw.freshness, 400),
    coverage: publicText(raw.coverage, 600),
    claimBoundary: publicText(raw.claimBoundary, 1000),
    finding,
    residual,
    notMeasured: Object.freeze(notMeasured),
  });
}
