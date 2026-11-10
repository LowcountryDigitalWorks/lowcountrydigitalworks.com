/**
 * Bounded, fail-closed CSS helpers for design token contract validation (no new dependencies).
 * Block comments only (no CSS line comments); strings and URLs preserved.
 */
import path from 'node:path';

export class CssSyntaxError extends Error {
  constructor(message, offset = 0) {
    super(message);
    this.name = 'CssSyntaxError';
    this.offset = offset;
  }
}

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

function isIdentStart(ch) {
  return /[a-zA-Z_]/.test(ch) || (ch && ch.charCodeAt(0) > 0x7f);
}

function isIdentChar(ch) {
  return /[a-zA-Z0-9_-]/.test(ch) || (ch && ch.charCodeAt(0) > 0x7f);
}

function readIdent(css, i) {
  if (!isIdentStart(css[i])) return { ident: '', next: i };
  const start = i;
  i += 1;
  while (i < css.length && isIdentChar(css[i])) i += 1;
  return { ident: css.slice(start, i), next: i };
}

/** Advance past a quoted CSS string starting at quote at css[i]. */
function consumeQuotedString(css, i) {
  const quote = css[i];
  if (quote !== '"' && quote !== "'") {
    throw new CssSyntaxError('expected quoted string', i);
  }
  i += 1;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    i += 1;
  }
  throw new CssSyntaxError('unclosed string', i);
}

/** Remove only block comments; preserve // and URL contents inside strings. */
export function stripCssComments(css) {
  if (typeof css !== 'string') return '';
  let out = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      out += ' ';
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i;
      i = consumeQuotedString(css, i);
      out += css.slice(start, i);
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function skipCommentsAndWhitespace(css, i) {
  while (i < css.length) {
    while (i < css.length && isWhitespace(css[i])) i += 1;
    if (css[i] === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function collectRootBlockBodies(css) {
  const bodies = [];
  let i = 0;
  while (i < css.length) {
    if (css[i] === '"' || css[i] === "'") {
      i = consumeQuotedString(css, i);
      continue;
    }
    if (css[i] === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      continue;
    }
    if (css[i] === ':') {
      const { ident, next } = readIdent(css, i + 1);
      if (ident === 'root') {
        let j = skipCommentsAndWhitespace(css, next);
        if (css[j] !== '{') {
          i += 1;
          continue;
        }
        j += 1;
        const bodyStart = j;
        let depth = 1;
        while (j < css.length && depth > 0) {
          const ch = css[j];
          if (ch === '"' || ch === "'") {
            j = consumeQuotedString(css, j);
            continue;
          }
          if (ch === '/' && css[j + 1] === '*') {
            j += 2;
            while (j < css.length && !(css[j] === '*' && css[j + 1] === '/')) j += 1;
            if (j >= css.length) throw new CssSyntaxError('unclosed block comment', j);
            j += 2;
            continue;
          }
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
          j += 1;
        }
        if (depth !== 0) {
          throw new CssSyntaxError('unclosed :root block', bodyStart);
        }
        bodies.push(css.slice(bodyStart, j - 1));
        i = j;
        continue;
      }
    }
    i += 1;
  }
  return bodies;
}

function skipToSemicolon(css, i) {
  let parenDepth = 0;
  const start = i;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = consumeQuotedString(css, i);
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === ';' && parenDepth === 0) return i + 1;
    i += 1;
  }
  throw new CssSyntaxError('unclosed declaration', start);
}

function readDeclarationValue(css, i) {
  let depth = 0;
  const start = i;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = consumeQuotedString(css, i);
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      return { value: css.slice(start, i).trim(), next: i + 1 };
    }
    i += 1;
  }
  throw new CssSyntaxError('unclosed declaration value', start);
}

function parseDeclarationsInBody(body) {
  const props = new Map();
  let i = skipCommentsAndWhitespace(body, 0);
  while (i < body.length) {
    i = skipCommentsAndWhitespace(body, i);
    if (i >= body.length) break;
    if (body[i] !== '-' || body[i + 1] !== '-') {
      i = skipToSemicolon(body, i);
      continue;
    }
    const nameStart = i;
    i += 2;
    while (i < body.length && isIdentChar(body[i])) i += 1;
    const name = body.slice(nameStart, i);
    i = skipCommentsAndWhitespace(body, i);
    if (body[i] !== ':') {
      throw new CssSyntaxError(`malformed custom property ${name}`, i);
    }
    i += 1;
    i = skipCommentsAndWhitespace(body, i);
    const { value, next } = readDeclarationValue(body, i);
    props.set(name, value.replace(/\s+/g, ' '));
    i = next;
  }
  return props;
}

/**
 * Parse effective custom properties from all :root blocks.
 * Throws CssSyntaxError on unbalanced comments/strings/braces.
 */
export function parseRootCustomProperties(css) {
  let bodies;
  try {
    bodies = collectRootBlockBodies(css);
  } catch (err) {
    if (err instanceof CssSyntaxError) {
      return { props: null, conflicts: [], error: err.message };
    }
    throw err;
  }
  if (bodies.length === 0) return { props: null, conflicts: [] };

  const merged = new Map();
  const conflicts = [];
  for (const body of bodies) {
    let blockProps;
    try {
      blockProps = parseDeclarationsInBody(body);
    } catch (err) {
      if (err instanceof CssSyntaxError) {
        return { props: null, conflicts: [], error: err.message };
      }
      throw err;
    }
    for (const [name, value] of blockProps) {
      if (merged.has(name) && merged.get(name) !== value) {
        conflicts.push({ name, first: merged.get(name), second: value });
      }
      merged.set(name, value);
    }
  }
  return { props: merged, conflicts };
}

function looksLikeAbsoluteOrRemote(spec) {
  const s = spec.trim();
  if (!s) return true;
  if (s.startsWith('/') || s.startsWith('\\')) return true;
  if (s.includes('\\')) return true;
  if (s.includes('?') || s.includes('#')) return true;
  if (s.startsWith('//')) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(s)) return true;
  return false;
}

function posixResolveImport(importerRel, importSpec) {
  const dir = path.posix.dirname(importerRel.replace(/\\/g, '/'));
  const joined = path.posix.normalize(path.posix.join(dir, importSpec.replace(/\\/g, '/')));
  if (joined.startsWith('../') || joined === '..') {
    return null;
  }
  return joined.replace(/^\.\//, '');
}

function parseImportPathFromStatement(stmt) {
  let i = skipCommentsAndWhitespace(stmt, 0);
  if (stmt[i] !== '@') throw new CssSyntaxError('not an @import', i);
  i += 1;
  const { ident, next } = readIdent(stmt, i);
  if (ident !== 'import') throw new CssSyntaxError('not an @import', i);
  i = skipCommentsAndWhitespace(stmt, next);

  let raw = '';
  if (stmt[i] === '"' || stmt[i] === "'") {
    const quote = stmt[i];
    const start = i + 1;
    i = consumeQuotedString(stmt, i);
    raw = stmt.slice(start, i - 1);
  } else if (isIdentStart(stmt[i]) && stmt.slice(i, i + 3).toLowerCase() === 'url') {
    i += 3;
    i = skipCommentsAndWhitespace(stmt, i);
    if (stmt[i] !== '(') throw new CssSyntaxError('malformed @import url()', i);
    i += 1;
    i = skipCommentsAndWhitespace(stmt, i);
    if (stmt[i] === '"' || stmt[i] === "'") {
      const start = i + 1;
      const quote = stmt[i];
      i = consumeQuotedString(stmt, i);
      raw = stmt.slice(start, i - 1);
    } else {
      const start = i;
      let depth = 1;
      while (i < stmt.length && depth > 0) {
        const ch = stmt[i];
        if (ch === '"' || ch === "'") {
          i = consumeQuotedString(stmt, i);
          continue;
        }
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
        i += 1;
      }
      if (depth !== 0) throw new CssSyntaxError('unclosed url() in @import', start);
      raw = stmt.slice(start, i).trim();
      i += 1;
    }
    i = skipCommentsAndWhitespace(stmt, i);
    if (stmt[i] !== ')') throw new CssSyntaxError('malformed @import url()', i);
  } else {
    const start = i;
    while (i < stmt.length && stmt[i] !== ';' && !isWhitespace(stmt[i])) i += 1;
    raw = stmt.slice(start, i).trim();
    if (!raw) throw new CssSyntaxError('empty @import path', start);
  }

  raw = raw.trim();
  if (looksLikeAbsoluteOrRemote(raw)) {
    return { rejected: true, reason: 'remote or non-relative import', raw };
  }
  return { rejected: false, raw };
}

function collectImportStatements(css) {
  const statements = [];
  let i = 0;
  let braceDepth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = consumeQuotedString(css, i);
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      if (i >= css.length) throw new CssSyntaxError('unclosed block comment', i);
      i += 2;
      continue;
    }
    if (ch === '{') {
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }
    if (braceDepth === 0) {
      const j = skipCommentsAndWhitespace(css, i);
      if (css[j] === '@') {
        const { ident, next } = readIdent(css, j + 1);
        if (ident === 'import') {
          const stmtStart = j;
          let k = skipCommentsAndWhitespace(css, next);
          let parenDepth = 0;
          let closed = false;
          while (k < css.length) {
            const c = css[k];
            if (c === '"' || c === "'") {
              k = consumeQuotedString(css, k);
              continue;
            }
            if (c === '/' && css[k + 1] === '*') {
              k += 2;
              while (k < css.length && !(css[k] === '*' && css[k + 1] === '/')) k += 1;
              if (k >= css.length) throw new CssSyntaxError('unclosed block comment', k);
              k += 2;
              continue;
            }
            if (c === '(') parenDepth += 1;
            else if (c === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (c === ';' && parenDepth === 0) {
              statements.push(css.slice(stmtStart, k + 1));
              i = k + 1;
              closed = true;
              break;
            }
            k += 1;
          }
          if (!closed) throw new CssSyntaxError('unclosed @import statement', stmtStart);
          continue;
        }
      }
    }
    i += 1;
  }
  return statements;
}

/**
 * Resolved repo-relative import paths from active @import statements.
 */
export function listActiveCssImports(css, importerRel) {
  if (typeof importerRel !== 'string' || !importerRel) {
    throw new CssSyntaxError('importer path required');
  }
  const statements = collectImportStatements(css);
  const resolved = [];
  for (const stmt of statements) {
    let parsed;
    try {
      parsed = parseImportPathFromStatement(stmt);
    } catch {
      continue;
    }
    if (parsed.rejected) continue;
    const canonical = posixResolveImport(importerRel, parsed.raw);
    if (canonical) resolved.push(canonical);
  }
  return resolved;
}

/** Exact match on canonical repo-relative path (no substring / .includes). */
export function hasActiveCssImport(css, importerRel, expectedResolvedRel) {
  if (typeof expectedResolvedRel !== 'string' || !expectedResolvedRel) return false;
  const expected = expectedResolvedRel.replace(/\\/g, '/');
  try {
    return listActiveCssImports(css, importerRel).some((target) => target === expected);
  } catch {
    return false;
  }
}
