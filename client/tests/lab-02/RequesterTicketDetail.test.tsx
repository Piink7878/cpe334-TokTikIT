import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequesterTicketDetail } from '../../src/pages/RequesterTicketDetail';
import * as api from '../../src/api';
import * as auth from '../../src/contexts/RequesterContext';

vi.mock('../../src/api');
vi.mock('../../src/contexts/RequesterContext');

describe('RequesterTicketDetail Component', () => {
  const mockRequester = { id: 1, name: 'John Doe', email: 'john@example.com' };
  
  const mockTicket = {
    id: 101,
    ticketNumber: 'TKT-2026-000101',
    summary: 'Test ticket summary',
    description: 'This is the description.',
    category: { id: 1, name: 'Hardware' },
    relatedSystem: { id: 2, name: 'Laptop' },
    requester: { id: 1, name: 'John Doe', email: 'john@example.com' },
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    status: 'NEW',
    createdAt: '2026-09-02T10:15:30.000Z',
    updatedAt: '2026-09-02T10:15:30.000Z',
    attachments: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (auth.useRequester as any).mockReturnValue({ selectedRequester: mockRequester });
  });

  const renderComponent = (ticketId = '101') => {
    return render(
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('shows loading spinner initially and fetches ticket', async () => {
    (api.getTicket as any).mockResolvedValueOnce({ data: mockTicket });
    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(api.getTicket).toHaveBeenCalledWith(101, mockRequester.id);
    });
  });

  it('renders read-only fields correctly', async () => {
    (api.getTicket as any).mockResolvedValueOnce({ data: mockTicket });
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Ticket Details').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('TKT-2026-000101')).toBeInTheDocument();
    expect(screen.getByText('Test ticket summary')).toBeInTheDocument();
    expect(screen.getByText('This is the description.')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows disabled tabs for out of scope features', async () => {
    (api.getTicket as any).mockResolvedValueOnce({ data: mockTicket });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Public Comments/)).toBeInTheDocument();
    });

    const commentsTab = screen.getByText(/Public Comments/);
    expect(commentsTab).toBeDisabled();

    const serviceActionsTab = screen.getByText(/Service Actions/);
    expect(serviceActionsTab).toBeDisabled();

    const eventLogTab = screen.getByText(/Event Log/);
    expect(eventLogTab).toBeDisabled();
  });

  it('shows error if ticket is not found', async () => {
    (api.getTicket as any).mockRejectedValueOnce(new Error('Ticket not found'));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ticket not found')).toBeInTheDocument();
    });
  });
});
