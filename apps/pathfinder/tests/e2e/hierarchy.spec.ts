// E2E for the org hierarchy and roll-up dashboards (Epic E3 - Org Hierarchy &
// Dashboards). Drives the real routes against `wrangler pages dev` with the
// local D1 binding and the seeded ELS911 tree (scripts/seed-hierarchy.mjs).
//
// T-3.3.1 (AC-3.3.1): the dashboard shows an aggregated roll-up of facility and
//                     project counts for the caller's scope.
// T-3.1.1 (AC-3.1.1): drilling org -> district -> facility -> building lists
//                     only each level's direct children.
// T-3.2.1 (AC-3.2.1): clicking a breadcrumb segment opens a dropdown of sibling
//                     entities at that level.
// AC-3.2.2 follow-through: selecting a sibling navigates to it at the same level.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('T-3.3.1 dashboard shows an aggregated roll-up of facilities and projects', async ({
	page
}) => {
	await login(page);

	// Roll-up cards render with the four scoped counts.
	const cards = page.getByTestId('rollup-cards');
	await expect(cards).toBeVisible();
	await expect(page.getByTestId('rollup-districts')).toBeVisible();
	await expect(page.getByTestId('rollup-facilities')).toBeVisible();
	await expect(page.getByTestId('rollup-buildings')).toBeVisible();
	await expect(page.getByTestId('rollup-projects')).toBeVisible();

	// Admin has global scope: the seed has >= 4 facilities and >= 4 projects
	// across both orgs, so the aggregated counts are non-zero.
	await expect(page.getByTestId('rollup-facilities')).toContainText(/[1-9]/);
	await expect(page.getByTestId('rollup-projects')).toContainText(/[1-9]/);

	// A facilities quick-link list is present.
	await expect(page.getByTestId('facility-list')).toBeVisible();

	await page.screenshot({
		path: 'tests/e2e/__screenshots__/dashboard-rollup.png',
		fullPage: true
	});
});

test('T-3.1.1 drilling district -> facility -> building lists direct children, and T-3.2.1 breadcrumb switcher jumps to a sibling', async ({
	page
}) => {
	await login(page);

	// 1. From the dashboard, open the Wellsboro district.
	await page.getByRole('link', { name: 'Wellsboro Area School District' }).click();
	await page.waitForURL('**/districts/**');
	await expect(page.getByRole('heading', { name: 'Wellsboro Area School District' })).toBeVisible();

	// District lists only its direct facilities (Wellsboro HS, Don Gill ES) and
	// not the standalone 911 center or the other org's facility.
	const facList = page.getByTestId('facility-list');
	await expect(facList).toContainText('Wellsboro Area High School');
	await expect(facList).toContainText('Don Gill Elementary School');
	await expect(facList).not.toContainText('Tioga County 911 Center');
	await expect(facList).not.toContainText('Northgate Middle School');

	// 2. Drill into Wellsboro Area High School.
	await page.getByRole('link', { name: 'Wellsboro Area High School' }).click();
	await page.waitForURL('**/facilities/**');
	await expect(page.getByRole('heading', { name: 'Wellsboro Area High School' })).toBeVisible();

	// Facility lists only its direct buildings (Main Building, Gymnasium).
	const bldList = page.getByTestId('building-list');
	await expect(bldList).toContainText('Main Building');
	await expect(bldList).toContainText('Gymnasium');

	// 3. Drill into Main Building.
	await page.getByRole('link', { name: 'Main Building' }).click();
	await page.waitForURL('**/buildings/**');
	await expect(page.getByRole('heading', { name: 'Main Building' })).toBeVisible();
	const buildingUrl = page.url();

	// Building lists only its direct projects (the seeded WAHS projects).
	await expect(page.getByTestId('project-list')).toContainText('Egress mapping review');

	// T-3.2.1: the building breadcrumb segment is a switcher. Click it; a dropdown
	// of sibling buildings (same facility) opens.
	const switcher = page.getByTestId('breadcrumb-switcher').last();
	await expect(switcher).toHaveAttribute('aria-expanded', 'false');
	await switcher.click();
	await expect(switcher).toHaveAttribute('aria-expanded', 'true');

	const siblings = page.getByTestId('breadcrumb-sibling');
	await expect(siblings.filter({ hasText: 'Gymnasium' })).toBeVisible();

	await page.screenshot({
		path: 'tests/e2e/__screenshots__/hierarchy-browse.png',
		fullPage: true
	});

	// AC-3.2.2: selecting the sibling navigates to it at the same hierarchy level.
	await siblings.filter({ hasText: 'Gymnasium' }).click();
	await page.waitForURL('**/buildings/**');
	await expect(page.getByRole('heading', { name: 'Gymnasium' })).toBeVisible();
	// It is a different building than where we started.
	expect(page.url()).not.toBe(buildingUrl);
});
