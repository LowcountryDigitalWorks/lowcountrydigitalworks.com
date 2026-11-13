import { test, expect } from '@playwright/test';

// WEB-160: browser geometry regression for customer-choice links.
// Pure read-only UI assertions. A green overflow/axe check alone missed visible
// card collisions in a development preview. No screenshots or provider calls.
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-375x667', width: 375, height: 667 },
];

for (const viewport of viewports) {
  test(`Home choice card content and arrows stay within their cards at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await page.evaluate(() => document.fonts.ready.then(() => true));

    // Explicitly check the real site section, not a synthetic isolated card.
    const cards = page.locator('#start .problem-choice-list > a.problem-choice');
    await expect(cards).toHaveCount(4);

    const layout = await cards.evaluateAll((nodes) => {
      const bounds = (element) => element.getBoundingClientRect();
      const area = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const inside = (inner, outer, tolerance = 1) =>
        inner.left >= outer.left - tolerance &&
        inner.right <= outer.right + tolerance &&
        inner.top >= outer.top - tolerance &&
        inner.bottom <= outer.bottom + tolerance;

      return nodes.map((card, index) => {
        // Main's number and the preview's nested number+icon are both valid
        // lead shapes; require each to remain separate from readable copy.
        const lead = card.querySelector(':scope > .problem-choice__lead, :scope > .problem-choice__number');
        const body = card.querySelector(':scope > .problem-choice__body');
        const arrow = card.querySelector(':scope > .problem-choice__arrow');
        const title = body?.querySelector('.problem-choice__title');
        const description = body?.querySelector('.problem-choice__desc');
        if (!lead || !body || !arrow || !title || !description) {
          return { index: index + 1, missingNodes: true };
        }

        const cardRect = bounds(card);
        const leadRect = bounds(lead);
        const bodyRect = bounds(body);
        const arrowRect = bounds(arrow);
        const titleRect = bounds(title);
        const descriptionRect = bounds(description);
        const visibleLead = leadRect.width > 0.5 && leadRect.height > 0.5;

        return {
          index: index + 1,
          display: getComputedStyle(card).display,
          leadTextOverlap: visibleLead ? area(leadRect, bodyRect) : 0,
          arrowBodyOverlap: area(arrowRect, bodyRect),
          arrowInsideCard: inside(arrowRect, cardRect),
          bodyInsideCard: inside(bodyRect, cardRect),
          titleInsideCard: inside(titleRect, cardRect),
          descriptionInsideCard: inside(descriptionRect, cardRect),
          cardWidth: cardRect.width,
        };
      });
    });

    for (const card of layout) {
      const label = `${viewport.name}: card ${card.index}`;
      expect(card.missingNodes, `${label} expected the card's real content and controls`).toBeFalsy();
      expect(card.display, `${label} browser stylesheet must be loaded`).toBe('grid');
      expect(card.cardWidth, `${label} must be rendered`).toBeGreaterThan(0);
      expect(card.leadTextOverlap, `${label} number/icon overlaps the copy`).toBeLessThan(1);
      expect(card.arrowBodyOverlap, `${label} arrow overlaps the copy`).toBeLessThan(1);
      expect(card.arrowInsideCard, `${label} arrow protrudes beyond its link`).toBe(true);
      expect(card.bodyInsideCard, `${label} copy container escapes the card`).toBe(true);
      expect(card.titleInsideCard, `${label} title escapes the card`).toBe(true);
      expect(card.descriptionInsideCard, `${label} description escapes the card`).toBe(true);
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(horizontalOverflow, `${viewport.name} must have no horizontal overflow`).toBe(false);
  });
}
