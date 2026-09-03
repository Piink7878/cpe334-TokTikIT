import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CreateTicket from '../../src/pages/CreateTicket';

vi.mock('../../src/contexts/RequesterContext', () => ({
  useRequester: vi.fn(() => ({
    selectedRequester: {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      department: 'IT',
      isActive: true
    },
    setSelectedRequester: vi.fn()
  }))
}));

// Mock the API calls
vi.mock('../../src/api', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 1, name: 'Hardware' }
  ]),
  getRelatedSystems: vi.fn().mockResolvedValue([
    { id: 1, name: 'Laptop' }
  ]),
  createTicket: vi.fn()
}));

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('CreateTicket Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation errors when submitting an empty form', async () => {
    renderWithContext(<CreateTicket />);
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Create Support Ticket')).toBeInTheDocument();
    });

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /submit ticket/i }));

    // Check for validation messages
    expect(await screen.findByText(/Category is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Related System is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Summary must be between 5 and 150 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Description must be between 10 and 3000 characters/i)).toBeInTheDocument();
  });

  it('shows busy state while submitting and success state after', async () => {
    const api = await import('../../src/api');
    // @ts-ignore
    api.createTicket.mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve({ data: { ticketNumber: 'TKT-2026-000123' } }), 100));
    });

    renderWithContext(<CreateTicket />);
    
    await waitFor(() => {
      expect(screen.getByText('Create Support Ticket')).toBeInTheDocument();
    });

    // We can query by role but there are multiple comboboxes. We'll use name attributes or generic matchers since label associations were made via DOM structure.
    // Instead of getByRole, let's use getByLabelText or getByRole.
    // For simplicity, wait for the form to appear and grab elements by generic tags.
    // However, labels in our component don't have 'htmlFor', they just wrap or precede.
    // We can find the inputs by placeholder or name.
    
    const categorySelect = document.querySelector('select[name="categoryId"]');
    const systemSelect = document.querySelector('select[name="relatedSystemId"]');
    const summaryInput = document.querySelector('input[name="summary"]');
    const descriptionArea = document.querySelector('textarea[name="description"]');

    if (!categorySelect || !systemSelect || !summaryInput || !descriptionArea) {
      throw new Error("Form elements not found");
    }

    fireEvent.change(categorySelect, { target: { value: '1' } });
    fireEvent.change(systemSelect, { target: { value: '1' } });
    fireEvent.change(summaryInput, { target: { value: 'Valid summary here' } });
    fireEvent.change(descriptionArea, { target: { value: 'This is a valid description that meets the length requirements.' } });

    const submitBtn = screen.getByRole('button', { name: /submit ticket/i });
    fireEvent.click(submitBtn);

    // Assert button is disabled and shows loading text
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent(/submitting/i);

    // Wait for success
    expect(await screen.findByText('Ticket Created Successfully')).toBeInTheDocument();
    expect(screen.getByText('TKT-2026-000123')).toBeInTheDocument();
  });
});
