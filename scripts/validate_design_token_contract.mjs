#!/usr/bin/env node
/**
 * Fail-closed validator for LDW website design token contract (WEB-COASTAL-SYSTEM-001 / #160).
 * Source-only; does not build CSS or mutate production output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = path.join(ROOT, 'design', 'site-token-contract.json');

function fail(message) {
  console.error(`[design-token-contract] ${message}`);
  process.exitCode = 1;
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function parseRootCustomProperties(cssText) {
  const rootMatch = cssText.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) return null;
  const props = new Map();
  const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(rootMatch[1])) !== null) {
    props.set(match[1], match[2].trim());
  }
  return props;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function main() {
  if (!fs.existsSync(CONTRACT_PATH)) {
    fail('missing design/site-token-contract.json');
    return;
  }

  const contract = JSON.parse(read('design/site-token-contract.json'));
  let errors = 0;
  const report = (message) => {
    errors += 1;
    fail(message);
  };

  const colorsJson = JSON.parse(read('brand/colors.json'));
  const brandCss = read('brand/css/brand-tokens.css');
  const brandProps = parseRootCustomProperties(brandCss);
  if (!brandProps) {
    report('brand/css/brand-tokens.css must define a :root block');
    process.exit(errors > 0 ? 1 : 0);
  }

  for (const [varName, hex] of Object.entries(contract.brand_literals.colors)) {
    const actual = brandProps.get(varName);
    const expected = normalizeHex(hex);
    const actualHex = normalizeHex(actual);
    if (actualHex !== expected) {
      report(`${varName} expected ${expected}, found ${actual ?? 'missing'}`);
    }
  }

  const jsonHexByToken = {
    '--ldw-estuary-navy': colorsJson.estuary_navy?.hex,
    '--ldw-cypress-teal': colorsJson.cypress_teal?.hex,
    '--ldw-warm-oyster': colorsJson.warm_oyster?.hex,
    '--ldw-soft-white': colorsJson.soft_white?.hex,
    '--ldw-white': colorsJson.white?.hex,
    '--ldw-black': colorsJson.black?.hex
  };
  for (const [varName, jsonHex] of Object.entries(jsonHexByToken)) {
    const brandHex = normalizeHex(brandProps.get(varName));
    const expected = normalizeHex(jsonHex);
    if (brandHex !== expected) {
      report(`brand/colors.json and brand-tokens.css mismatch for ${varName}`);
    }
  }

  const designCss = read(contract.design_application_literals.source_file);
  if (!designCss.includes(contract.brand_literals.source_files[1].replace('brand/', '../brand/'))) {
    report('design/tokens.css must import brand/css/brand-tokens.css');
  }
  const designProps = parseRootCustomProperties(designCss);
  if (!designProps) {
    report('design/tokens.css must define a :root block');
  } else {
    for (const [name, hex] of Object.entries(contract.design_application_literals.values)) {
      const actual = designProps.get(name);
      const isHex = hex.startsWith('#');
      if (isHex) {
        if (normalizeHex(actual) !== normalizeHex(hex)) {
          report(`${name} expected ${hex}, found ${actual ?? 'missing'}`);
        }
      } else if (actual !== hex) {
        report(`${name} expected ${hex}, found ${actual ?? 'missing'}`);
      }
    }
    for (const [alias, brandVar] of Object.entries(contract.design_application_literals.aliases_to_brand)) {
      const actual = designProps.get(alias);
      const expected = `var(${brandVar})`;
      if (actual !== expected) {
        report(`${alias} expected ${expected}, found ${actual ?? 'missing'}`);
      }
    }
  }

  const globalCss = read(contract.site_runtime_aliases.source_file);
  if (!globalCss.includes(contract.site_runtime_aliases.import_brand_tokens)) {
    report('src/styles/global.css must import brand/css/brand-tokens.css');
  }
  const siteProps = parseRootCustomProperties(globalCss);
  if (!siteProps) {
    report('src/styles/global.css must define a :root block');
  } else {
    for (const [alias, brandVar] of Object.entries(contract.site_runtime_aliases.aliases_to_brand)) {
      const actual = siteProps.get(alias);
      const expected = `var(${brandVar})`;
      if (actual !== expected) {
        report(`site ${alias} expected ${expected}, found ${actual ?? 'missing'}`);
      }
    }
    for (const [name, value] of Object.entries(contract.site_runtime_aliases.literals)) {
      const actual = siteProps.get(name);
      const isHex = value.startsWith('#');
      if (isHex) {
        if (normalizeHex(actual) !== normalizeHex(value)) {
          report(`site ${name} expected ${value}, found ${actual ?? 'missing'}`);
        }
      } else if (actual !== value) {
        report(`site ${name} expected ${value}, found ${actual ?? 'missing'}`);
      }
    }
    for (const [name, entry] of Object.entries(contract.site_runtime_aliases.intentional_drift)) {
      const actual = siteProps.get(name);
      if (normalizeHex(actual) !== normalizeHex(entry.literal)) {
        report(`intentional drift ${name} expected ${entry.literal}, found ${actual ?? 'missing'}`);
      }
    }
  }

  if (errors === 0) {
    console.log('[design-token-contract] PASS');
    process.exit(0);
  }
  process.exit(1);
}

main();
