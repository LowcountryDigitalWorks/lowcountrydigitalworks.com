import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const work = JSON.parse(readFileSync(new URL('../src/data/work.json', import.meta.url), 'utf8'));
const serviceDetails = JSON.parse(readFileSync(new URL('../src/data/service-details.json', import.meta.url), 'utf8'));

const clientIds = ['east-coast-foam', 'donovan-family-dentistry'];

const assertNoHorizontalOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow, `${label} should not overflow horizontally`).toBeFalsy();
};

test('WEB-TRUST-001 keeps client proof data-first and separate from internal projects', async () => {
  expect(work.clientWork.items.map((client) => client.id)).toEqual(clientIds);
  expect(work.clientWork.items.map((client) => client.name)).toEqual(['East Coast Foam', 'Donovan Family Dentistry']);
  expect(work.projects.map((project) => project.slug)).toEqual(['document-control', 'secure-exchange', 'gas-engine']);

  const websites = serviceDetails.find((service) => service.slug === 'websites');
  expect(websites?.relatedClientWork).toEqual(clientIds);
  expect(websites?.relatedWork).toEqual([]);

  const businessSystems = serviceDetails.find((service) => service.slug === 'business-systems-automation');
  expect(businessSystems?.relatedWork).toEqual(['document-control', 'secure-exchange']);
  expect(businessSystems?.relatedClientWork).toBeUndefined();
});

test('homepage routes permissioned client proof before LDW systems and preserves internal evidence', async ({ page }) => {
  await page.goto('/');

  const clientSection = page.locator('[data-home-client-work]');
  const internalSection = page.locator('[data-home-internal-proof]');
  await expect(clientSection).toHaveCount(1);
  await expect(internalSection).toHaveCount(1);
  await expect(clientSection.getByText('Client work', { exact: true })).toBeVisible();
  await expect(clientSection.getByRole('heading', { level: 2, name: 'Real engagements, bounded to what is live and documented.' })).toBeVisible();
  await expect(internalSection.getByText('LDW systems & internal proof', { exact: true })).toBeVisible();
  await expect(internalSection.getByRole('heading', { level: 2, name: 'Internal systems stay clearly separate from client engagements.' })).toBeVisible();

  const clientBeforeInternal = await page.evaluate(() => {
    const client = document.querySelector('[data-home-client-work]');
    const internal = document.querySelector('[data-home-internal-proof]');
    if (!client || !internal) return false;
    return Boolean(client.compareDocumentPosition(internal) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(clientBeforeInternal).toBeTruthy();

  const eastCoastFoam = clientSection.locator('[data-client-proof="east-coast-foam"]');
  await expect(eastCoastFoam.getByRole('heading', { level: 3, name: 'East Coast Foam' })).toBeVisible();
  await expect(eastCoastFoam.getByText('Live client site', { exact: true })).toBeVisible();
  await expect(eastCoastFoam.getByRole('link', { name: 'Visit East Coast Foam live site' })).toHaveAttribute('href', 'https://eastcoastfoamllc.com/');
  await expect(eastCoastFoam.getByRole('link', { name: 'Visit East Coast Foam live site' })).toHaveAttribute('rel', /noopener/);
  await expect(eastCoastFoam.getByRole('link', { name: 'Visit East Coast Foam live site' })).toHaveAttribute('rel', /noreferrer/);

  const donovan = clientSection.locator('[data-client-proof="donovan-family-dentistry"]');
  await expect(donovan.getByRole('heading', { level: 3, name: 'Donovan Family Dentistry' })).toBeVisible();
  await expect(donovan.getByText('Live client site', { exact: true })).toBeVisible();
  await expect(donovan.getByRole('link', { name: 'Visit Donovan Family Dentistry live site' })).toHaveAttribute('href', 'https://donovanfamilydentistry.com/');
  await expect(donovan.getByRole('link', { name: 'Visit Donovan Family Dentistry live site' })).toHaveAttribute('rel', /noopener/);
  await expect(donovan.getByRole('link', { name: 'Visit Donovan Family Dentistry live site' })).toHaveAttribute('rel', /noreferrer/);
  await expect(clientSection.getByRole('link', { name: 'See all work →' })).toHaveAttribute('href', '/work/');

  await expect(internalSection.locator('.portfolio-grid--home .portfolio-card')).toHaveCount(3);
  await expect(internalSection.getByRole('heading', { level: 3, name: 'Document Control' })).toBeVisible();
  await expect(internalSection.getByRole('heading', { level: 3, name: 'Secure Exchange' })).toBeVisible();
  await expect(internalSection.getByRole('heading', { level: 3, name: 'G.A.S. Engine' })).toBeVisible();
  await expect(internalSection.locator('a[href="/work/document-control/"]')).toHaveCount(2);
  await expect(internalSection.locator('a[href="/work/secure-exchange/"]')).toHaveCount(2);
  await expect(internalSection.locator('a[href="/work/gas-engine/"]')).toHaveCount(2);

  const homeWorkThumbs = internalSection.locator('.portfolio-card__visual img');
  await expect(homeWorkThumbs).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect(homeWorkThumbs.nth(i)).toHaveAttribute('loading', 'lazy');
    await homeWorkThumbs.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(async () => homeWorkThumbs.nth(i).evaluate((img) => [img.complete, img.naturalWidth, img.naturalHeight]))
      .toEqual([true, 720, 450]);
  }

  const main = page.locator('#main-content');
  await expect(main).not.toContainText('HIPAA-certified');
  await expect(main).not.toContainText('HIPAA compliant');
  await expect(main).not.toContainText('patient growth');
  await expect(main).not.toContainText('conversion increase');
  await expect(main).not.toContainText('ranking increase');
  await expect(main).not.toContainText('revenue increase');
  await expect(main).not.toContainText('Donovan owns');
  await expect(main.locator('iframe, embed')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await assertNoHorizontalOverflow(page, 'homepage client proof');
});

test('Websites service renders exactly related client proof before FAQ while other internal related work stays unchanged', async ({ page }) => {
  await page.goto('/services/websites/');

  const clientSection = page.locator('[data-related-client-work]');
  await expect(clientSection).toHaveCount(1);
  await expect(clientSection.getByText('Client work', { exact: true })).toBeVisible();
  await expect(clientSection.getByRole('heading', { level: 2, name: 'See the website work in production.' })).toBeVisible();
  await expect(clientSection.locator('[data-client-proof]')).toHaveCount(2);

  const eastCoastFoam = clientSection.locator('[data-client-proof="east-coast-foam"]');
  const donovan = clientSection.locator('[data-client-proof="donovan-family-dentistry"]');
  await expect(eastCoastFoam.getByRole('heading', { level: 3, name: 'East Coast Foam' })).toBeVisible();
  await expect(eastCoastFoam.getByRole('link', { name: 'Visit East Coast Foam live site' })).toHaveAttribute('href', 'https://eastcoastfoamllc.com/');
  await expect(donovan.getByRole('heading', { level: 3, name: 'Donovan Family Dentistry' })).toBeVisible();
  await expect(donovan.getByRole('link', { name: 'Visit Donovan Family Dentistry live site' })).toHaveAttribute('href', 'https://donovanfamilydentistry.com/');
  await expect(clientSection.getByRole('link', { name: 'See full work context & boundaries →' })).toHaveAttribute('href', '/work/');
  await expect(clientSection.locator('a[href="/work/east-coast-foam/"]')).toHaveCount(0);
  await expect(clientSection.locator('a[href="/work/donovan-family-dentistry/"]')).toHaveCount(0);

  const clientBeforeFaq = await page.evaluate(() => {
    const client = document.querySelector('[data-related-client-work]');
    const faq = document.querySelector('.faq-list');
    if (!client || !faq) return false;
    return Boolean(client.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(clientBeforeFaq).toBeTruthy();

  const main = page.locator('#main-content');
  await expect(main).not.toContainText('HIPAA-certified');
  await expect(main).not.toContainText('HIPAA compliant');
  await expect(main).not.toContainText('patient growth');
  await expect(main).not.toContainText('conversion increase');
  await expect(main).not.toContainText('ranking increase');
  await expect(main).not.toContainText('revenue increase');
  await expect(main).not.toContainText('Donovan owns');
  await expect(main.locator('iframe, embed')).toHaveCount(0);

  await page.goto('/services/business-systems-automation/');
  await expect(page.locator('.related-work-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Document Control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure Exchange' })).toBeVisible();
  await expect(page.locator('[data-related-client-work]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services/websites/');
  await assertNoHorizontalOverflow(page, 'Websites client proof');
});
