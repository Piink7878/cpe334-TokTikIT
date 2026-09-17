import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequesterTicketDetail } from '../../src/pages/RequesterTicketDetail';
import * as api from '../../src/api';
import * as auth from '../../src/contexts/AuthContext';

vi.mock('../../src/api');
vi.mock('../../src/contexts/AuthContext');

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
    (auth.useAuth as any).mockReturnValue({ user: mockRequester });
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
      expect(api.getTicket).toHaveBeenCalledWith(101);
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
    expect(commentsTab).not.toBeDisabled();

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

  it('submits a public comment when form is filled and button clicked', async () => {
    (api.getTicket as any).mockResolvedValueOnce({ data: mockTicket });
    (api.postTicketComment as any).mockResolvedValueOnce({ data: { id: 1, body: 'New comment' } });
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Public Comments/)).toBeInTheDocument();
    });

    const commentsTab = screen.getByText(/Public Comments/);
    await user.click(commentsTab);

    const textarea = screen.getByPlaceholderText('Type your message here...');
    await user.type(textarea, 'This is a test comment');

    const postButton = screen.getByRole('button', { name: 'Post Comment' });
    await user.click(postButton);

    await waitFor(() => {
      expect(api.postTicketComment).toHaveBeenCalledWith(101, 'This is a test comment');
    });
  });

  it('calls indicateTicketResolved when Problem Appears Resolved is clicked and confirmed', async () => {
    (api.getTicket as any).mockResolvedValueOnce({ data: mockTicket });
    (api.indicateTicketResolved as any).mockResolvedValueOnce({ data: { id: 1 } });
    
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockImplementation(() => true);

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Problem Appears Resolved')).toBeInTheDocument();
    });

    const resolveBtn = screen.getByText('Problem Appears Resolved');
    await user.click(resolveBtn);

    expect(confirmSpy).toHaveBeenCalled();
    
    await waitFor(() => {
      expect(api.indicateTicketResolved).toHaveBeenCalledWith(101);
    });

    confirmSpy.mockRestore();
  });
});
