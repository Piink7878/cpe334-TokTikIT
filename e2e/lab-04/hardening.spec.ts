import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Lab 4 Issue 6: every screen of every role is checked for console errors, failed API calls, broken internal links,
// placeholder text, horizontal overflow, small touch targets and automated WCAG A/AA violations.

const PASSWORD = 'Password123!';
const ACCOUNTS = {
  requester: 'req2@toktikit.local',
  staff: 'staff2@toktikit.local',
  admin: 'admin@toktikit.local'
} as const;

// Internal routes the application defines; every in-page link must resolve to one of them.
const KNOWN_ROUTES = [
  /^\/$/, /^\/login$/, /^\/change-password$/, /^\/my-tickets$/, /^\/requester-dashboard$/, /^\/create-ticket$/,
  /^\/tickets\/\d+$/, /^\/staff-queue$/, /^\/staff-dashboard$/, /^\/staff\/tickets\/\d+$/, /^\/user-management$/, /^\/health$/
];

const PLACEHOLDER_TEXT = /lorem ipsum|\bTODO\b|\bFIXME\b|undefined|\[object Object\]|\bNaN\b|coming soon/i;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url || '';
    if (url.includes('/api/auth/me')) return; // the anonymous session probe legitimately answers 401
    problems.push(`console error: ${m.text()} ${url}`);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/') && r.status() >= 400 && !url.includes('/api/auth/me')) problems.push(`API ${r.status()} ${url}`);
  });
  return problems;
}

async function audit(page: Page, label: string, problems: string[]) {
  await page.waitForLoadState('networkidle');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) problems.push(`${label}: horizontal overflow`);

  const text = await page.evaluate(() => document.body.innerText);
  const placeholder = text.match(PLACEHOLDER_TEXT);
  if (placeholder) problems.push(`${label}: placeholder-like text "${placeholder[0]}"`);

  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''));
  for (const href of hrefs) {
    if (!href || href.startsWith('http') || href.startsWith('mailto:')) continue;
    if (href === '#') {
      problems.push(`${label}: dead link href="#"`);
      continue;
    }
    const path = href.split(/[?#]/)[0];
    if (!KNOWN_ROUTES.some((r) => r.test(path))) problems.push(`${label}: link to unknown route ${href}`);
  }

  const tooSmall = await page.evaluate(() => {
    const out: string[] = [];
    const selector = 'button, a.btn, a.kpi-card, .navbar .nav-link, input[type="submit"], [role="tab"]';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue; // not rendered
      if (box.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(box.height)}px`);
    }
    return out;
  });
  const width = page.viewportSize()?.width ?? 1280;
  const isNarrow = width < 992;
  if (isNarrow) for (const t of tooSmall) problems.push(`${label}: touch target below 44px: ${t}`);

  // Phones: every control and link is a touch target, at least 44 x 44px (ui-spec 5.4, TC-A11Y-06).
  if (width < 768) {
    const fieldsTooSmall = await page.evaluate(() => {
      const out: string[] = [];
      // Every control and link, measured in both directions. A check-box or radio is measured by its labelled row, which is what is tapped.
      const selector = 'button, a[href], select, input:not([type="hidden"]), textarea';
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const isChoice = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
        // A link inside a sentence is an inline link, which WCAG 2.5.8 exempts from the target-size rule.
        const inSentence = el instanceof HTMLAnchorElement && Array.from(el.parentElement?.childNodes ?? []).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 10);
        if (inSentence) continue;
        const target = isChoice ? ((el.closest('.form-check, label') as HTMLElement | null) ?? el) : el;
        const box = target.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
        if (box.height < 43.5 || box.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 24)}" ${Math.round(box.width)}x${Math.round(box.height)}px`);
      }
      return out;
    });
    for (const t of fieldsTooSmall) problems.push(`${label}: form field or link below 44px: ${t}`);
  }

  // Tablets and phones: nothing may be clipped inside its card or table container, and no drop-down label may be cut off (TC-UI-02, TC-UI-07).
  if (isNarrow) {
    const clipped = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.card, .table-responsive'))) {
        if (el.getBoundingClientRect().width === 0) continue;
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.className.toString().slice(0, 40)} content ${el.scrollWidth}px wider than its ${el.clientWidth}px box`);
      }
      const canvas = document.createElement('canvas').getContext('2d')!;
      for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>('select'))) {
        const box = sel.getBoundingClientRect();
        if (box.width === 0) continue;
        const style = getComputedStyle(sel);
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = sel.selectedOptions[0]?.text ?? '';
        const room = sel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
        if (canvas.measureText(text).width > room) out.push(`drop-down "${text}" is truncated (needs ${Math.round(canvas.measureText(text).width)}px, has ${Math.round(room)}px)`);
      }
      return out;
    });
    for (const c of clipped) problems.push(`${label}: clipped content: ${c}`);
  }

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const v of axe.violations) problems.push(`${label}: axe ${v.id} (${v.impact}) x${v.nodes.length} - ${v.nodes[0].target.join(' ')}`);
}

async function createTicket(page: Page): Promise<number> {
  const categories = await (await page.request.get('/api/categories')).json();
  const systems = await (await page.request.get('/api/related-systems')).json();
  const res = await page.request.post('/api/tickets', {
    multipart: {
      categoryId: String((categories.data ?? categories)[0].id),
      relatedSystemId: String((systems.data ?? systems)[0].id),
      requestedPriority: 'HIGH',
      summary: `Hardening e2e ticket ${Date.now()}`,
      description: 'Created by the hardening e2e check to give every screen real data.'
    }
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data.id;
}

test.describe('Hardening sweep (Lab 4 Issue 6)', () => {
  test('login screen', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/login');
    await audit(page, '/login', problems);
    expect(problems).toEqual([]);
  });

  test('requester screens', async ({ page }) => {
    const problems = watch(page);
    await login(page, ACCOUNTS.requester);
    const ticketId = await createTicket(page);
    for (const route of ['/my-tickets', '/requester-dashboard', '/create-ticket', `/tickets/${ticketId}`, '/my-tickets?status=NEW,OPEN,IN_PROGRESS']) {
      await page.goto(route);
      await audit(page, route, problems);
    }
    expect(problems).toEqual([]);
  });

  test('IT staff screens', async ({ page }) => {
    const problems = watch(page);
    await login(page, ACCOUNTS.requester);
    const ticketId = await createTicket(page);
    await page.context().clearCookies();
    await login(page, ACCOUNTS.staff);
    // Internal Notes and public comments must exist so that the Ticket Detail scan covers their colours (a note's author
    // name once failed WCAG contrast, and a scan of an empty Ticket could not see it).
    const note = await page.request.post(`/api/tickets/${ticketId}/internal-notes`, { data: { content: 'Hardening e2e internal note' } });
    expect(note.status()).toBe(201);
    const comment = await page.request.post(`/api/tickets/${ticketId}/comments`, { data: { content: 'Hardening e2e public comment' } });
    expect(comment.status()).toBe(201);
    // Claim the Ticket so the Assignment drop-down shows a real name ("IT Staff Two (IT_STAFF)"), which is its longest content.
    const claim = await page.request.patch(`/api/staff/tickets/${ticketId}/claim`, { data: {} });
    expect(claim.status()).toBe(200);
    for (const route of ['/staff-dashboard', '/staff-queue', `/staff/tickets/${ticketId}`, '/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS']) {
      await page.goto(route);
      await audit(page, route, problems);
    }
    expect(problems).toEqual([]);
  });

  test('administrator screens', async ({ page }) => {
    const problems = watch(page);
    await login(page, ACCOUNTS.admin);
    for (const route of ['/user-management', '/staff-dashboard', '/staff-queue']) {
      await page.goto(route);
      await audit(page, route, problems);
    }

    await page.goto('/user-management');
    await page.getByRole('button', { name: /Create User/ }).click();
    await audit(page, 'create-user dialog', problems);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /Edit/ }).first().click();
    await audit(page, 'edit-user dialog', problems);
    await page.getByRole('dialog').getByRole('button', { name: 'Set New Initial Password' }).click();
    await audit(page, 'reset-password dialog', problems);
    expect(problems).toEqual([]);
  });

  test('navigation menu is reachable at every width', async ({ page }) => {
    await login(page, ACCOUNTS.staff);
    await page.goto('/staff-dashboard');
    const navbar = page.locator('nav.navbar');
    const toggler = navbar.getByRole('button', { name: 'Toggle navigation' });
    const narrow = (page.viewportSize()?.width ?? 1280) < 992;

    if (narrow) {
      await expect(toggler).toBeVisible();
      await expect(navbar.getByRole('link', { name: 'Ticket Queue' })).toBeHidden();
      await toggler.click();
      await expect(toggler).toHaveAttribute('aria-expanded', 'true');
      await navbar.getByRole('link', { name: 'Ticket Queue' }).click();
      await expect(page).toHaveURL(/\/staff-queue/);
      await expect(navbar.getByRole('link', { name: 'Dashboard', exact: true })).toBeHidden(); // menu closed after navigating
    } else {
      await expect(toggler).toBeHidden();
      await navbar.getByRole('link', { name: 'Ticket Queue' }).click();
      await expect(page).toHaveURL(/\/staff-queue/);
    }
  });

  test('logout leaves the app even when the session has already expired', async ({ page }) => {
    await login(page, ACCOUNTS.requester);
    await page.goto('/my-tickets');
    // The server answers the logout call as for an expired session.
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }) })
    );
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  // The server saves the request but the response never reaches the browser (timeout). The user submits again.
  // The retry carries the same Idempotency-Key, so nothing is created twice.
  async function loseFirstResponse(page: Page, urlPart: string) {
    let lost = false;
    await page.route(`**${urlPart}`, async (route) => {
      if (route.request().method() !== 'POST' || lost) return route.continue();
      lost = true;
      await route.fetch(); // the server processes the request and commits it
      await route.abort('timedout'); // ...but the browser never sees the answer
    });
  }

  test('a lost response on ticket creation does not create a duplicate when the user retries', async ({ page }) => {
    await login(page, ACCOUNTS.requester);
    await page.goto('/create-ticket');
    await loseFirstResponse(page, '/api/tickets');

    const summary = `Retry safety ticket ${Date.now()}`;
    await page.getByLabel(/Category/).selectOption({ index: 1 });
    await page.getByLabel(/Related System/).selectOption({ index: 1 });
    await page.getByLabel(/Ticket Summary/).fill(summary);
    await page.getByLabel(/Description/).fill('The first response was lost, so the form is submitted a second time.');

    await page.getByRole('button', { name: /submit ticket/i }).click();
    await expect(page.getByText(/Unable to reach the server/)).toBeVisible();
    await expect(page.getByLabel(/Ticket Summary/)).toHaveValue(summary); // nothing was lost from the form

    await page.getByRole('button', { name: /submit ticket/i }).click();
    await expect(page.getByRole('heading', { name: 'Ticket Created Successfully' })).toBeVisible();

    const list = await (await page.request.get(`/api/tickets?search=${encodeURIComponent(summary)}`)).json();
    expect(list.pagination.totalItems).toBe(1);
  });

  test('a lost response on a comment or an internal note does not duplicate it when retried', async ({ page }) => {
    // A ticket owned by the requester to comment on.
    await login(page, ACCOUNTS.requester);
    const ticketId = await createTicket(page);

    // Requester comment
    const comment = `Retry safety comment ${Date.now()}`;
    await page.goto(`/tickets/${ticketId}`);
    await page.getByRole('button', { name: /Public Comments/ }).click();
    await loseFirstResponse(page, `/api/tickets/${ticketId}/comments`);
    await page.getByPlaceholder('Type your message to IT staff...').fill(comment);
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await expect(page.getByText(/Unable to reach the server/)).toBeVisible();
    await expect(page.getByPlaceholder('Type your message to IT staff...')).toHaveValue(comment);
    await page.getByRole('button', { name: 'Post Comment' }).click();
    await expect(page.getByText('Comment added successfully.')).toBeVisible();
    const comments = await (await page.request.get(`/api/tickets/${ticketId}/comments`)).json();
    expect(comments.data.filter((c: any) => c.content === comment)).toHaveLength(1);

    // Staff internal note
    await page.context().clearCookies();
    await page.unroute('**/*');
    await login(page, ACCOUNTS.staff);
    const note = `Retry safety note ${Date.now()}`;
    await page.goto(`/staff/tickets/${ticketId}`);
    await loseFirstResponse(page, `/api/tickets/${ticketId}/internal-notes`);
    await page.getByPlaceholder('Write an internal operational note...').fill(note);
    await page.getByRole('button', { name: 'Save Internal Note' }).click();
    await expect(page.getByText(/Unable to reach the server/)).toBeVisible();
    await expect(page.getByPlaceholder('Write an internal operational note...')).toHaveValue(note);
    await page.getByRole('button', { name: 'Save Internal Note' }).click();
    await expect(page.getByText('Internal note added successfully')).toBeVisible();
    const notes = await (await page.request.get(`/api/tickets/${ticketId}/internal-notes`)).json();
    expect(notes.data.filter((n: any) => n.content === note)).toHaveLength(1);
  });
});
