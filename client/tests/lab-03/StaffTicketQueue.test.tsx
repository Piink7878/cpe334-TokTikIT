import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue";
import { AuthProvider } from "../../src/contexts/AuthContext";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../src/api";

// Mock the API module
vi.mock("../../src/api", async () => {
  const actual = await vi.importActual("../../src/api");
  return {
    ...actual as any,
    getStaffTickets: vi.fn(),
    getCategories: vi.fn(),
  };
});

describe("StaffTicketQueue Component", () => {
  const mockUser = {
    id: "staff-123",
    fullName: "IT Staff",
    email: "staff@example.com",
    role: "IT_STAFF",
    mustChangePassword: false,
  };

  const mockCategories = [
    { id: 1, name: "Network" },
    { id: 2, name: "Hardware" },
  ];

  const mockTickets = [
    {
      id: 1,
      ticketNumber: "TKT-2026-000001",
      summary: "Network is down",
      category: { id: 1, name: "Network" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      requester: { id: "req-1", name: "Alice" },
      owner: { id: "staff-123", name: "IT Staff" },
      createdAt: "2026-09-16T10:00:00.000Z",
      updatedAt: "2026-09-16T10:00:00.000Z",
    },
    {
      id: 2,
      ticketNumber: "TKT-2026-000002",
      summary: "Mouse broken",
      category: { id: 2, name: "Hardware" },
      requestedPriority: "LOW",
      itPriority: "MEDIUM",
      status: "NEW",
      requester: { id: "req-2", name: "Bob" },
      owner: null,
      createdAt: "2026-09-16T11:00:00.000Z",
      updatedAt: "2026-09-16T11:00:00.000Z",
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getCategories as any).mockResolvedValue(mockCategories);
    (api.getStaffTickets as any).mockResolvedValue({
      data: mockTickets,
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    // Mock useAuth internally if needed, or rely on AuthProvider
    // but the real AuthProvider fetches /api/auth/me on mount which can be problematic in unit tests.
    // Let's just mock the AuthContext context value directly if needed, or mock global fetch.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser }),
    }) as any;
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <StaffTicketQueue />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it("renders loading state initially", () => {
    const { container } = renderComponent();
    expect(container.querySelector(".placeholder-glow")).toBeInTheDocument();
  });

  it("renders the table with tickets after loading", async () => {
    const { container } = renderComponent();
    
    await waitFor(() => {
      expect(container.querySelector(".placeholder-glow")).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("TKT-2026-000001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Network is down").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TKT-2026-000002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mouse broken").length).toBeGreaterThan(0);
    
    // Check IT Priority badge vs Requested priority
    const highBadges = screen.getAllByText("HIGH");
    expect(highBadges.length).toBeGreaterThan(1); 

    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
  });

  it("renders empty state if no tickets returned", async () => {
    (api.getStaffTickets as any).mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText("No tickets found.")).toBeInTheDocument();
    });
  });
});
