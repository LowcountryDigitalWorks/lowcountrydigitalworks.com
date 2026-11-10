#!/usr/bin/env node
/**
 * Fail-closed validator for LDW website design token contract (WEB-COASTAL-SYSTEM-001 / #160).
 * Source-only; does not build CSS or mutate production output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasActiveCssImport,
  parseRootCustomProperties
} from './design_token_contract_lib.mjs';

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

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function loadRootProps(cssText, label, report) {
  const parsed = parseRootCustomProperties(cssText);
  if (!parsed.props) {
    report(`${label} must define at least one :root block`);
    return null;
  }
  for (const conflict of parsed.conflicts) {
    report(
      `${label} conflicting declarations for ${conflict.name}: ${conflict.first} vs ${conflict.second}`
    );
  }
  return parsed.props;
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
  const brandProps = loadRootProps(brandCss, 'brand/css/brand-tokens.css', report);
  if (!brandProps) {
    process.exit(1);
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
  const brandImportPath = '../brand/css/brand-tokens.css';
  if (!hasActiveCssImport(designCss, brandImportPath)) {
    report('design/tokens.css must actively @import brand/css/brand-tokens.css');
  }
  const designProps = loadRootProps(designCss, contract.design_application_literals.source_file, report);
  if (designProps) {
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
  if (!hasActiveCssImport(globalCss, contract.site_runtime_aliases.import_brand_tokens)) {
    report('src/styles/global.css must actively import brand/css/brand-tokens.css');
  }
  const siteProps = loadRootProps(globalCss, contract.site_runtime_aliases.source_file, report);
  if (siteProps) {
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
