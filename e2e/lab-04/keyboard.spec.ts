import { test, expect, Page } from '@playwright/test';
import { login, createTicketAsRequester, STAFF } from './helpers';

// Lab 4 keyboard operation and accessible names / roles / states (TC-A11Y-01 .. TC-A11Y-05, TC-STY-01, TC-STY-02).
// These are automated stand-ins for a manual keyboard and screen-reader pass: they exercise the real browser with the keyboard only
// and assert the accessibility tree (names, roles, states, live regions). They do not replace listening to a screen reader.
// Run on desktop Chromium only: WebKit and Firefox use different default Tab stops for buttons and checkboxes.
test.describe('Keyboard operation, accessible names and Zen Green tokens (Lab 4)', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'keyboard walk runs on desktop Chromium only');

  async function activeLabel(page: Page) {
    return page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      return ((e?.getAttribute('aria-label') || e?.innerText || e?.tagName || '') as string).trim().replace(/\s+/g, ' ');
    });
  }

  async function tabUntil(page: Page, label: RegExp, max = 60) {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const text = await activeLabel(page);
      if (label.test(text)) return text;
    }
    throw new Error(`Tab never reached an element named ${label}`);
  }

  async function hasVisibleFocusIndicator(page: Page) {
    return page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
    });
  }

  test('TC-A11Y-01 dashboard cards are reached with Tab, show a focus ring and open their list with Enter', async ({ page }) => {
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto('/staff-dashboard');
    await expect(page.getByRole('heading', { name: 'IT Staff Dashboard' })).toBeVisible();
    await page.locator('a.kpi-card').first().waitFor();

    const reached = await tabUntil(page, /Unassigned Tickets/);
    expect(reached).toMatch(/Unassigned Tickets/);
    expect(await hasVisibleFocusIndicator(page)).toBe(true); // TC-STY-02: visible keyboard focus
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/staff-queue\?ownerId=unassigned&status=NEW,OPEN/);
  });

  test('TC-A11Y-02 Add Action dialog: opened by keyboard, Tab stays inside, Escape closes it and returns focus', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E keyboard dialog');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);

    const opener = page.getByRole('button', { name: '+ Add the first Action Taken' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Record Action Taken' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true); // focus moved into the dialog

    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} left the dialog`).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Shift+Tab ${i + 1} left the dialog`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await activeLabel(page)).toMatch(/Add the first Action Taken|Add Action Taken/); // focus returned to the opener
  });

  test('TC-A11Y-03 form fields expose names and error state to assistive technology', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E accessible names');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await page.getByRole('button', { name: '+ Add the first Action Taken' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Action Taken' });

    // every field has an accessible name; required ones say so
    for (const name of [/^Description/, /^Result/, 'Action Date/Time', 'Assigned To', 'Follow-Up Required', /^Follow-Up Note/, 'Attachment Notes']) {
      await expect(dialog.getByLabel(name)).toBeVisible();
    }
    await expect(dialog.getByLabel(/^Description/)).toHaveAttribute('aria-required', 'true');
    await expect(dialog.getByLabel(/^Result/)).toHaveAttribute('aria-required', 'true');

    // an invalid submit marks the field invalid and links it to its message
    await dialog.getByRole('button', { name: 'Record Action' }).click();
    const description = dialog.getByLabel(/^Description/);
    await expect(description).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await description.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Description is required.');
    expect(await description.evaluate((el) => document.activeElement === el)).toBe(true); // focus moves to the first invalid field
  });

  test('TC-A11Y-04 a status change by keyboard is announced in a live region', async ({ page }) => {
    test.slow();
    const ticket = await createTicketAsRequester('E2E keyboard status');
    await login(page, STAFF.email, /\/staff-queue/);
    await page.request.patch(`/api/staff/tickets/${ticket.id}/claim`, { data: {} });
    await page.goto(`/staff/tickets/${ticket.id}`);

    const select = page.locator('#status-select');
    await select.focus();
    await page.keyboard.type('In'); // type-ahead picks "IN PROGRESS" (RESOLVED is gated by the Resolution Gate)
    expect(await select.inputValue()).toBe('IN_PROGRESS');
    await page.keyboard.press('Tab');
    expect(await activeLabel(page)).toBe('Change');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Status updated successfully');
    await expect(page.getByRole('button', { name: 'Dismiss' }).first()).toBeVisible(); // the banner's close button has a name
  });

  test('TC-A11Y-05 dashboard landmarks, headings and card names are exposed', async ({ page }) => {
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto('/staff-dashboard');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'IT Staff Dashboard', level: 1 })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Queue Status Breakdown' })).toBeVisible();
    for (const card of [/Unassigned Tickets/, /My Active Tickets/, /Follow-Up Required/, /Critical \/ High Priority/]) {
      const link = main.getByRole('link', { name: card });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', /\/staff-queue/);
    }
    // the status breakdown badges are links with a text name (status is never conveyed by colour alone)
    await expect(main.getByRole('link', { name: /NEW:\s*\d+/ })).toBeVisible();
  });

  test('TC-STY-01 Zen Green tokens are used by the shell and the metric cards', async ({ page }) => {
    await login(page, STAFF.email, /\/staff-queue/);
    await page.goto('/staff-dashboard');
    await page.locator('a.kpi-card').first().waitFor();
    const result = await page.evaluate(() => {
      const resolve = (token: string, prop: 'color' | 'backgroundColor') => {
        const probe = document.createElement('div');
        (probe.style as any)[prop] = `var(${token})`;
        document.body.append(probe);
        const value = getComputedStyle(probe)[prop];
        probe.remove();
        return value;
      };
      const brand = getComputedStyle(document.querySelector('.navbar-brand') as Element).color;
      const cardBg = getComputedStyle(document.querySelector('a.kpi-card') as Element).backgroundColor;
      const value = getComputedStyle(document.querySelector('.kpi-value') as Element).color;
      return {
        brand, primary: resolve('--color-primary', 'color'),
        cardBg, pale: resolve('--color-pale-green', 'backgroundColor'),
        value
      };
    });
    expect(result.cardBg).toBe(result.pale);
    expect(result.value).toBe(result.primary);
    expect(result.brand).not.toBe('rgb(13, 110, 253)'); // Bootstrap's default blue must not leak into the brand
  });
});
