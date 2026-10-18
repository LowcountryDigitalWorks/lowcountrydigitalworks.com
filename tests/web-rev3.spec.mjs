import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const areas = [
  'Beaufort', 'Port Royal', 'Habersham', 'Lady’s Island', 'Burton',
  'St. Helena Island', 'Fripp Island', 'Bluffton', 'Okatie', 'Ridgeland', 'Hardeeville',
];

test('homepage uses discovery-first hierarchy and publishes the accepted service area in HTML', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const primary = page.getByRole('link', { name: 'Start with discovery' });
  await expect(primary).toHaveAttribute('href', '/discovery/');
  await expect(page.getByRole('link', { name: 'See services' })).toHaveAttribute('href', '#start');
  await expect(page.getByRole('link', { name: 'See the work' })).toHaveAttribute('href', '#client-work');

  const listedAreas = await page.locator('.service-area__list li').allTextContents();
  expect(listedAreas).toEqual(areas);
  expect(listedAreas).not.toContain('Hilton Head');
  await expect(page.locator('.service-area')).toContainText('Hilton Head work is considered case by case.');
});

test('mobile Text and Call use public contact values, have 44px targets, and pass axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'Quick contact' });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link', { name: 'Text Eddie at 843-633-3123' })).toHaveAttribute('href', 'sms:+18436333123');
  await expect(bar.getByRole('link', { name: 'Call Eddie at 843-633-3123' })).toHaveAttribute('href', 'tel:+18436333123');

  const targetSizes = await bar.locator('a').evaluateAll((links) => links.map((link) => {
    const { width, height } = link.getBoundingClientRect();
    return { width, height };
  }));
  expect(targetSizes).toHaveLength(2);
  for (const target of targetSizes) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter(({ impact }) => ['critical', 'serious'].includes(impact))).toEqual([]);
  expect(await page.evaluate(() => CSS.supports('padding-bottom: env(safe-area-inset-bottom, 0px)'))).toBeTruthy();
  await expect(page.locator('[style]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
});

test('mobile contact chrome is hidden at wide and short viewports and on discovery/connect', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 820, height: 844 },
    { width: 390, height: 559 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Quick contact' })).toBeHidden();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/discovery/', '/connect/']) {
    await page.goto(route);
    await expect(page.locator('.mobile-contact-bar')).toHaveCount(0);
  }
});

test('mobile contact chrome hides while a form control is focused', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const bar = page.locator('.mobile-contact-bar');
  await expect(bar).toBeVisible();

  await page.evaluate(() => {
    const form = document.createElement('form');
    const label = document.createElement('label');
    label.textContent = 'Test field';
    const input = document.createElement('input');
    input.name = 'test-field';
    label.append(input);
    form.append(label);
    document.querySelector('main').prepend(form);
    input.focus();
  });
  await expect(bar).toBeHidden();
});

test('homepage has no horizontal overflow at 360px or 390px and keeps keyboard/reduced-motion support', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBeFalsy();
  }

  await page.keyboard.press('Tab');
  const focusStyle = await page.evaluate(() => {
    const active = document.activeElement;
    const style = getComputedStyle(active);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).toBe('solid');
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(3);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('html').evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe('auto');
});
