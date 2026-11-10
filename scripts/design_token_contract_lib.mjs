/**
 * Comment-aware CSS helpers for design token contract validation (no new dependencies).
 */

export function stripCssComments(css) {
  if (typeof css !== 'string') return '';
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (css[i] === '/' && css[i + 1] === '/') {
      while (i < css.length && css[i] !== '\n' && css[i] !== '\r') i += 1;
      continue;
    }
    out += css[i];
    i += 1;
  }
  return out;
}

function extractRootBlockBodies(css) {
  const stripped = stripCssComments(css);
  const bodies = [];
  const re = /:root\s*\{/gi;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;
    while (i < stripped.length && depth > 0) {
      if (stripped[i] === '{') depth += 1;
      else if (stripped[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth === 0) {
      bodies.push(stripped.slice(start, i - 1));
    }
  }
  return bodies;
}

/**
 * Parse effective custom properties from all :root blocks (comment-stripped).
 * Duplicate names with differing values are reported in conflicts.
 */
export function parseRootCustomProperties(css) {
  const bodies = extractRootBlockBodies(css);
  if (bodies.length === 0) return { props: null, conflicts: [] };

  const props = new Map();
  const conflicts = [];
  const declRe = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g;

  for (const body of bodies) {
    let match;
    while ((match = declRe.exec(body)) !== null) {
      const name = match[1];
      const value = match[2].trim().replace(/\s+/g, ' ');
      if (props.has(name) && props.get(name) !== value) {
        conflicts.push({ name, first: props.get(name), second: value });
      }
      props.set(name, value);
    }
  }

  return { props, conflicts };
}

/**
 * Active @import targets after comment removal (url(...) or quoted paths).
 */
export function listActiveCssImports(css) {
  const stripped = stripCssComments(css);
  const imports = [];
  const re = /@import\s+([^;]+);/gi;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    let target = match[1].trim();
    const urlMatch = target.match(/^url\(\s*(['"]?)(.+?)\1\s*\)$/i);
    if (urlMatch) {
      target = urlMatch[2];
    }
    target = target.replace(/^['"]|['"]$/g, '').trim();
    if (target) imports.push(target);
  }
  return imports;
}

export function hasActiveCssImport(css, requiredPathFragment) {
  if (typeof requiredPathFragment !== 'string' || !requiredPathFragment) return false;
  return listActiveCssImports(css).some((target) => target.includes(requiredPathFragment));
}
