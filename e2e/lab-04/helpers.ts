import { expect, Page, request } from '@playwright/test';

// Shared helpers for the Lab 4 flow specs (actions-taken-flow, ticket-resolution, dashboards).

export const PASSWORD = 'Password123!';
export const REQUESTER = { email: 'req2@toktikit.local', name: 'Requester Two' };
export const STAFF = { email: 'staff2@toktikit.local', name: 'IT Staff Two' };

export async function login(page: Page, email: string, landing: RegExp) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(landing);
}

// Creates a fresh NEW ticket as the seeded requester through the API (each test gets its own ticket).
export async function createTicketAsRequester(summary: string, priority = 'MEDIUM'): Promise<{ id: number; ticketNumber: string }> {
  const api = await request.newContext({ baseURL: 'http://localhost:5173' });
  try {
    const loginRes = await api.post('/api/auth/login', { data: { email: REQUESTER.email, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    const categories = await (await api.get('/api/categories')).json();
    const systems = await (await api.get('/api/related-systems')).json();
    const res = await api.post('/api/tickets', {
      multipart: {
        categoryId: String((categories.data ?? categories)[0].id),
        relatedSystemId: String((systems.data ?? systems)[0].id),
        requestedPriority: priority,
        summary: `${summary} ${Date.now()}`,
        description: 'Created by a Lab 4 end-to-end flow.'
      }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return { id: body.data.id, ticketNumber: body.data.ticketNumber };
  } finally {
    await api.dispose();
  }
}
