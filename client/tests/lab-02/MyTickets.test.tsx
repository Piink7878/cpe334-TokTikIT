import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MyTickets from '../../src/pages/MyTickets';

// Mock API calls using hoisted variables to ensure they are available when vi.mock is hoisted
const { mockGetCategories, mockGetTickets } = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockGetTickets: vi.fn()
}));

vi.mock('../../src/api', () => ({
  getCategories: (...args: any[]) => mockGetCategories(...args),
  getTickets: (...args: any[]) => mockGetTickets(...args)
}));

// Mock useRequester context
const { mockUseRequester } = vi.hoisted(() => ({
  mockUseRequester: vi.fn()
}));

vi.mock('../../src/contexts/RequesterContext', () => ({
  useRequester: () => mockUseRequester()
}));

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
};

describe('MyTickets Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set default requester
    mockUseRequester.mockReturnValue({
      selectedRequester: { id: 1, name: 'Test User' }
    });

    // Set default categories
    mockGetCategories.mockResolvedValue([
      { id: 1, name: 'Hardware' },
      { id: 2, name: 'Software' }
    ]);
    
    // Set default tickets mock
    mockGetTickets.mockReset();
  });

  it('shows loading state initially', () => {
    // Return a promise that never resolves so it stays in loading state
    mockGetTickets.mockImplementation(() => new Promise(() => {}));
    
    renderWithContext(<MyTickets />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders data table correctly when tickets exist', async () => {
    mockGetTickets.mockResolvedValue({
      data: [
        {
          id: 1,
          ticketNumber: 'TKT-2026-000001',
          summary: 'Test ticket summary',
          category: { id: 1, name: 'Hardware' },
          requestedPriority: 'HIGH',
          itPriority: 'HIGH',
          status: 'NEW',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      pagination: {
        page: 1,
        pageSize: 8,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });

    renderWithContext(<MyTickets />);

    await waitFor(() => {
      expect(screen.getAllByText('TKT-2026-000001')[0]).toBeInTheDocument();
    });

    expect(screen.getAllByText('Test ticket summary')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Hardware')[0]).toBeInTheDocument();
  });

  it('shows Empty State when user has no tickets at all', async () => {
    mockGetTickets.mockResolvedValue({
      data: [],
      pagination: {
        page: 1, pageSize: 8, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false
      }
    });

    renderWithContext(<MyTickets />);

    await waitFor(() => {
      expect(screen.getByText('No tickets found')).toBeInTheDocument();
    });
    
    expect(screen.getByText("You haven't submitted any support tickets yet. Click below to get started.")).toBeInTheDocument();
  });

  it('shows No-Results State when filters match nothing', async () => {
    mockGetTickets.mockImplementation(async (requesterId, filters) => {
      if (filters?.search === 'NotFound') {
        return {
          data: [],
          pagination: { page: 1, pageSize: 8, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
        };
      }
      return {
        data: [{ 
          id: 1, 
          ticketNumber: 'TKT-1',
          summary: 'A ticket',
          category: { id: 1, name: 'Hardware' },
          requestedPriority: 'LOW',
          itPriority: 'LOW',
          status: 'NEW',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        pagination: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
      };
    });

    renderWithContext(<MyTickets />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getAllByText('TKT-1')[0]).toBeInTheDocument();
    });

    // Apply a search filter
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'NotFound' } });

    await waitFor(() => {
      expect(screen.getByText('No matching tickets')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: /Clear All Filters/i })).toBeInTheDocument();
  });

  it('shows Error State when API fails', async () => {
    mockGetTickets.mockRejectedValue(new Error('Backend connection failed'));

    renderWithContext(<MyTickets />);

    await waitFor(() => {
      expect(screen.getByText('Backend connection failed')).toBeInTheDocument();
    });
  });
});
