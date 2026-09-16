import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../src/contexts/AuthContext";
import * as api from "../../src/api";

// Mock the API module
vi.mock("../../src/api", async () => {
  const actual = await vi.importActual("../../src/api");
  return {
    ...actual,
    getStaffTicketDetail: vi.fn(),
    getStaffAssignees: vi.fn(),
    claimTicket: vi.fn(),
    assignTicket: vi.fn(),
    updateTicketPriority: vi.fn(),
    updateTicketStatus: vi.fn()
  };
});

// Mock Auth Context slightly simpler
const mockUser = {
  id: "staff-1",
  fullName: "IT Staff",
  email: "staff@example.com",
  role: "IT_STAFF"
};

const mockAuthContextValue = {
  user: mockUser,
  login: vi.fn(),
  logout: vi.fn()
};

vi.mock("../../src/contexts/AuthContext", async () => {
  const actual = await vi.importActual("../../src/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => mockAuthContextValue
  };
});

describe("StaffTicketDetail UI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderComponent = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/staff/tickets/1"]}>
          <Routes>
            <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it("should render ticket details after loading", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      owner: { id: "staff-2", fullName: "Other Staff", email: "other@example.com" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    (api.getStaffTicketDetail as any).mockResolvedValue(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: [] });

    renderComponent();

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
      expect(screen.getByText("Cannot access VPN")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Other Staff")).toBeInTheDocument();
    });
  });

  it("should display permitted next statuses in dropdown", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW", // NEW status
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    (api.getStaffTicketDetail as any).mockResolvedValue(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /Status Transition/i });
    expect(statusSelect).toBeInTheDocument();
    
    // In NEW status, options should be OPEN, REJECTED, CANCELLED
    const options = Array.from(statusSelect.querySelectorAll("option")).map(o => o.value);
    expect(options).toContain("NEW"); // The current selected disabled value
    expect(options).toContain("OPEN");
    expect(options).toContain("REJECTED");
    expect(options).toContain("CANCELLED");
    expect(options).not.toContain("RESOLVED");
    expect(options).not.toContain("CLOSED");
  });

  it("should show rejection modal and require a reason when transitioning to REJECTED", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW", // NEW status
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    (api.getStaffTicketDetail as any).mockResolvedValue(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: [] });
    (api.updateTicketStatus as any).mockResolvedValue({ message: "Success" });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /Status Transition/i });
    fireEvent.change(statusSelect, { target: { value: "REJECTED" } });
    
    const changeBtn = screen.getByText("Change");
    fireEvent.click(changeBtn);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Reject Ticket" })).toBeInTheDocument();
    });

    const submitRejectBtn = screen.getByRole("button", { name: "Reject Ticket" });
    expect(submitRejectBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Enter rejection reason/i);
    fireEvent.change(textarea, { target: { value: "Not an IT issue" } });
    
    expect(submitRejectBtn).not.toBeDisabled();
    
    fireEvent.click(submitRejectBtn);

    await waitFor(() => {
      expect(api.updateTicketStatus).toHaveBeenCalledWith(1, "REJECTED", "Not an IT issue");
    });
  });
});
