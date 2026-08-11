#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
ERRORS=[]
def error(msg): ERRORS.append(msg)

REQUIRED=[
 'README.md','CHANGELOG.md','SECURITY.md','package.json','astro.config.mjs','playwright.config.mjs','wrangler.jsonc',
 '.github/workflows/validate.yml','.github/dependabot.yml','brand/colors.json','brand/css/brand-tokens.css',
 'brand/logo/lowcountry-digital-works-logo-horizontal.svg','brand/logo/lowcountry-digital-works-logo-horizontal-white.svg',
 'brand/icons/favicon.svg','brand/social/social-card-1200x630.png','design/brand-production-validation.md','src/pages/index.astro','src/pages/services.astro',
 'src/pages/work.astro','src/pages/approach.astro','src/pages/about.astro','src/pages/contact.astro','src/pages/privacy.astro','src/data/work.json',
 'public/technology/github.svg','public/technology/cloudflare.svg','public/technology/astro.svg','public/technology/typescript.svg','public/technology/python.svg',
 'docs/technology-marks.md','public/_headers','public/robots.txt','public/sitemap.xml'
]
for rel in REQUIRED:
 if not (ROOT/rel).exists(): error(f'missing required file: {rel}')

try:
 pkg=json.loads((ROOT/'package.json').read_text())
 if 'astro' not in pkg.get('dependencies',{}): error('package.json must include Astro')
 if pkg.get('scripts',{}).get('build')!='astro build': error('package.json build script must be astro build')
except Exception as exc: error(f'invalid package.json: {exc}')

wr=(ROOT/'wrangler.jsonc').read_text()
if '"name": "lowcountrydigitalworks"' not in wr: error('wrangler Worker name changed unexpectedly')
if '"directory": "./dist"' not in wr: error('wrangler assets directory must be ./dist')
if '"not_found_handling": "404-page"' not in wr: error('wrangler 404 handling missing')

headers=(ROOT/'public/_headers').read_text()
for h in ['Content-Security-Policy','Permissions-Policy','Referrer-Policy','X-Content-Type-Options','X-Frame-Options']:
 if h not in headers: error(f'missing security header: {h}')
if "'unsafe-inline'" in headers or "'unsafe-eval'" in headers: error('CSP must not allow unsafe-inline/eval')

brand=(ROOT/'brand/css/brand-tokens.css').read_text()
for value in ['#102A3A','#2F766F','#F3EFE6','#F7F8F6']:
 if value not in brand: error(f'brand token missing {value}')
design_tokens=(ROOT/'design/tokens.css').read_text()
if '--logo-watermark-' in design_tokens: error('retired logo watermark opacity tokens remain')
if '../brand/css/brand-tokens.css' not in design_tokens: error('design tokens must reference canonical brand tokens')

site_implementation='\n'.join(p.read_text(errors='ignore') for p in (ROOT/'src').rglob('*') if p.is_file())
if 'linear-gradient(' in site_implementation: error('marketing site should not use gradients in the approved restrained visual direction')
if 'backdrop-filter' in site_implementation: error('marketing site should not use decorative glassmorphism/backdrop filtering')

class P(HTMLParser):
 def __init__(self):
  super().__init__(); self.ids=set(); self.dups=[]; self.links=[]; self.h1=0; self.main=0; self.title=0; self.lang=False; self.viewport=False; self.description=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='html' and a.get('lang'): self.lang=True
  if tag=='main': self.main+=1
  if tag=='h1': self.h1+=1
  if tag=='title': self.title+=1
  if tag=='meta' and a.get('name')=='viewport': self.viewport=True
  if tag=='meta' and a.get('name')=='description': self.description=True
  if 'id' in a:
   if a['id'] in self.ids: self.dups.append(a['id'])
   self.ids.add(a['id'])
  if tag in {'a','link','script','img'}:
   u=a.get('href') or a.get('src')
   if u:self.links.append(u)

if not DIST.exists(): error('dist/ missing; run npm run build before validator')
else:
 htmls=sorted(DIST.rglob('*.html'))
 if len(htmls)<8: error(f'expected at least 8 built HTML pages, found {len(htmls)}')
 for file in htmls:
  parser=P(); text=file.read_text(errors='replace'); parser.feed(text)
  rel=file.relative_to(DIST)
  if not parser.lang: error(f'{rel}: missing html lang')
  if parser.title!=1: error(f'{rel}: expected one title, found {parser.title}')
  if not parser.viewport: error(f'{rel}: missing viewport meta')
  if not parser.description: error(f'{rel}: missing description meta')
  if parser.main!=1: error(f'{rel}: expected one main, found {parser.main}')
  if parser.h1!=1: error(f'{rel}: expected one h1, found {parser.h1}')
  if parser.dups: error(f'{rel}: duplicate ids {parser.dups}')
  for u in parser.links:
   if u.startswith(('mailto:','http://','https://','data:','#')): continue
   parsed=urlparse(u); path=parsed.path
   if not path.startswith('/'): continue
   target=DIST/path.lstrip('/')
   candidates=[target]
   if path.endswith('/'): candidates.append(target/'index.html')
   else: candidates += [Path(str(target)+'.html'), target/'index.html']
   if not any(c.exists() for c in candidates): error(f'{rel}: broken internal asset/link {u}')

robots=(ROOT/'public/robots.txt').read_text(); sitemap=(ROOT/'public/sitemap.xml').read_text()
for icon in ['github.svg','cloudflare.svg','astro.svg','typescript.svg','python.svg']:
 if not (ROOT/'public'/'technology'/icon).read_text(errors='ignore').lstrip().startswith('<svg'): error(f'invalid technology SVG: {icon}')
if 'https://lowcountrydigitalworks.com/sitemap.xml' not in robots: error('robots must declare production sitemap')
for route in ['/','/services/','/work/','/approach/','/about/','/contact/','/privacy/']:
 if f'https://lowcountrydigitalworks.com{route}' not in sitemap: error(f'sitemap missing {route}')

# Repository secret-pattern review on text files only; skip generated/vendor paths.
patterns=[
 ('private key', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
 ('github token', re.compile(r'\bgh[pousr]_[A-Za-z0-9._-]{30,}\b')),
 ('github fine-grained token', re.compile(r'\bgithub_pat_[A-Za-z0-9_]{20,}\b')),
 ('openai-style key', re.compile(r'\bsk-[A-Za-z0-9_-]{20,}\b')),
]
for p in ROOT.rglob('*'):
 if not p.is_file() or any(x in p.parts for x in {'.git','node_modules','dist','.wrangler'}): continue
 if p.suffix.lower() in {'.png','.ico','.jpg','.jpeg','.webp','.zip'}: continue
 try:text=p.read_text(errors='ignore')
 except Exception:continue
 for name,rx in patterns:
  if rx.search(text): error(f'possible {name} in {p.relative_to(ROOT)}')

if ERRORS:
 print('Repository validation failed:')
 for e in ERRORS: print(f'- {e}')
 sys.exit(1)
print('Repository validation passed.')
