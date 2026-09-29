# UX Research Notes — 2026-09-29

## Purpose

These notes translate current UX, accessibility, local-business, and design research into reusable Lowcountry Digital Works website-delivery guidance. They are design inputs, not mandates. The owning site still decides what is proportionate for its audience, content, budget, support model, and evidence.

## Core lesson

A good service website should make the right next step feel obvious before it asks the visitor to understand the organization in detail.

For LDW, that means preserving the current problem-led information architecture while making the experience warmer, more human, more visually distinctive, and less document-like.

## What strong service sites consistently do

### 1. Make the first screen specific

A visitor should be able to answer, quickly:

- What does this business help with?
- Is it for an organization like mine?
- What should I do next?
- Who is behind it?
- Why should I trust the operating model?

Avoid clever language that hides the task. Specific labels create stronger information scent than vague verbs such as “Explore” or “Discover.”

### 2. Use aesthetics to reinforce usability

Visual polish changes how people perceive ease, quality, and credibility, but it cannot compensate for poor findability or unclear interaction.

Use visual design to make hierarchy clearer:

- one dominant page purpose;
- shorter overview copy;
- generous whitespace;
- clear contrast;
- obvious actions;
- progressive disclosure for detail.

### 3. Give overview first, depth second

Current 2026 design practice increasingly favors concise “TL;DR” experiences for B2B and service sites: a visitor can understand the offer from the overview, then choose deeper service, evidence, FAQ, and process content.

For LDW:

- Home and Services should be concise and decision-oriented.
- Service pages should explain outcomes and fit.
- Work pages should hold detailed evidence, maturity, and boundaries.
- About should carry deeper founder/background material.

### 4. Human craft is a differentiator

As generic AI-generated layouts become common, human judgment, intentional spacing, authentic imagery, and a coherent local visual language can make a small consultancy feel more credible than adding animation or more technology.

For LDW, the approved founder portrait is useful because the business is intentionally owner-operated. Use it as an accountability signal, not as a personality-brand takeover.

### 5. Local-business visitors keep researching

Local buyers often move from reviews/search results to the business website and continue comparing information before making contact. The site therefore has to reassure and orient, not merely rank or exist.

High-value website signals include:

- complete service information;
- clear business/category fit;
- authentic photos/work evidence;
- location/context;
- a low-friction next step.

Do not fabricate testimonials, reviews, outcomes, or client proof to imitate larger agencies.

## Production-delivery reinforcement

Recent LDW local-business website delivery reinforces the same research direction:

- lead with the actual service/category and local context instead of agency language;
- use real business, owner, facility, project, or work photography when authorized and useful;
- expose one obvious primary task such as call, request an estimate, get directions, prepare for a visit, or start a conversation;
- keep secondary tasks nearby but visually subordinate;
- make direct contact information easy to find;
- use complete operating information such as location, hours, service area, forms, or project evidence when those details reduce visitor uncertainty;
- treat the homepage as an orientation and trust surface rather than an exhaustive document.

This is a reusable delivery pattern, not permission to publish any customer relationship or case study. Named customer proof remains separately publicity-gated.

## Accessibility and interaction baseline

Keep accessibility structural rather than bolt-on:

- semantic headings and landmarks;
- visible keyboard focus;
- touch/click targets at least 24×24 CSS px where WCAG 2.2 requires, with LDW generally targeting 44px for primary controls;
- text labels in addition to icons;
- responsive behavior without horizontal overflow;
- adequate contrast;
- meaningful alt text where an image communicates content;
- reduced-motion support;
- no accessibility overlay as a substitute for implementation quality.

## Performance baseline

Preserve the static-first architecture and current Core Web Vitals discipline.

Current good thresholds:

- LCP: 2.5 seconds or less;
- INP: 200 milliseconds or less;
- CLS: 0.1 or less;

measured at the 75th percentile.

Continue to:

- supply image dimensions;
- avoid unnecessary client JavaScript;
- self-host required assets where practical;
- prefer SVG for interface marks;
- avoid theme/plugin stacks added only for appearance.

## Lowcountry visual language

Official Beaufort-area destination material repeatedly emphasizes tidal water, marsh, live oaks, palmettos, historic texture, and warm hospitality.

Translate that into restrained interface cues rather than tourism decoration:

- Estuary Navy as depth/anchor;
- Cypress Teal as action and wayfinding;
- Warm Oyster as hospitality/background;
- Soft White for breathing room;
- broad, calm spacing;
- gentle tidal/organic curves made with CSS;
- subtle layered surfaces instead of stock-tech gradients;
- authentic local/founder imagery when available.

Avoid:

- generic “cyber” imagery;
- fake office/team photography;
- excessive Spanish-moss stock photos;
- tourism-site styling;
- decorative use of cultural traditions that are not LDW’s story.

## Template research

Reviewed current Astro theme patterns including:

- Daymark — warm editorial B2B presentation;
- Mend — local-services, task-first conversion structure;
- ScaleUp / Bizzen — consulting and proof-led service structures;
- Lumio Lite — lightweight agency baseline.

### Decision

Do not replace the current LDW site with a theme.

The current Astro/Tidal/security foundation is more tailored and has stronger ownership, privacy, accessibility, and release controls. Borrow patterns rather than dependencies:

- warmer editorial composition;
- clear solution paths;
- concise overview copy;
- strong proof/evidence placement;
- larger visual moments;
- restrained local identity.

Do not introduce Tailwind, a CMS, animation runtime, form processor, blog stack, analytics, or paid theme merely to obtain a prettier layout.

## Reusable LDW design principles

1. **Start with the visitor’s problem, not LDW’s org chart.**
2. **Make the first screen answer what / who / next.**
3. **Use human presence early when personal accountability is genuinely part of delivery.**
4. **Overview first; evidence and boundaries one click deeper.**
5. **Local should feel contextual, not themed.**
6. **Warmth comes from spacing, language, surfaces, and authentic imagery—not decorative clutter.**
7. **Every visual element should support recognition, trust, or action.**
8. **Customer ownership remains part of the UX story because it is a real differentiator.**
9. **No invented proof.**
10. **Prefer a $0 CSS/content refinement over a framework/theme migration.**

## WEB-UX-004 application

The first bounded application should:

- make the Home hero solution-first;
- move the approved founder portrait/accountability signal into the first screen;
- make “where do I start?” the secondary hero action;
- preserve the three problem-led starting points and make them visually easier to scan;
- add subtle Tidal/Lowcountry CSS depth without external imagery;
- remove the duplicate mid-page founder block;
- keep Work as concise proof;
- retain deeper ownership/process/FAQ content;
- end with a warmer Lowcountry-rooted invitation.

## Sources reviewed

- Nielsen Norman Group — Aesthetic-Usability Effect: https://www.nngroup.com/articles/aesthetic-usability-effect/
- Nielsen Norman Group — Information Scent: https://www.nngroup.com/articles/information-scent/
- Nielsen Norman Group — Information Architecture mistakes: https://www.nngroup.com/articles/3-ia-mistakes/
- Webflow — 2026 web design trends: https://webflow.com/blog/web-design-trends-2026
- web.dev — Core Web Vitals: https://web.dev/articles/vitals
- W3C — WCAG: https://www.w3.org/TR/wcag/
- BrightLocal — Local Consumer Review Survey: https://www.brightlocal.com/research/local-consumer-review-survey/
- Visit Beaufort — planning/local destination context: https://www.beaufortsc.org/plan-your-visit/
- Astro theme reference — Daymark: https://astro.build/themes/details/daymark-saas-b2b-astro-theme/
- Astro theme reference — Mend: https://astro.build/themes/details/mend-trades-local-services-astro-theme/
