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

function publicText(value, maxLength = 600) {
  if (typeof value !== 'string' || value.trim().length === 0 ||
    value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value) ||
    /(?:https?:\/\/|data:|javascript:|file:|ftp:)/iu.test(value)) {
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
  return Object.freeze({
    id: publicId(value.id),
    category: publicText(value.category, 120),
    title: publicText(value.title, 160),
    summary: publicText(value.summary),
    meaning: publicText(value.meaning, 1000),
    action: publicText(value.action, 1000),
    verification: publicText(value.verification, 1000),
    owner: publicText(value.owner, 120),
    comparisonBasis: value.comparisonBasis,
    beforeCount: observedCount(value.beforeCount),
    afterCount: observedCount(value.afterCount),
    recheck: publicText(value.recheck),
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
  const notMeasured = raw.notMeasured.map((item) => publicText(item, 160));
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
