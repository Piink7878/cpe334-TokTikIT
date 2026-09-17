import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    updateTicketStatus: vi.fn(),
    postTicketComment: vi.fn(),
    postInternalNote: vi.fn()
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
  it("should trigger claim ticket and assert API call", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW",
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
    (api.claimTicket as any).mockResolvedValue({ message: "Success" });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const claimBtn = screen.getByRole("button", { name: "Claim Ticket" });
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(api.claimTicket).toHaveBeenCalledWith(1);
    });
  });

  it("should select assignee, assign ticket, and assert API call", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW",
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };
    const mockAssignees = [
      { id: "staff-2", fullName: "Staff Two", role: "IT_STAFF" }
    ];

    (api.getStaffTicketDetail as any).mockResolvedValue(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: mockAssignees });
    (api.assignTicket as any).mockResolvedValue({ message: "Success" });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const assigneeSelect = screen.getByLabelText(/Assignment/i);
    fireEvent.change(assigneeSelect, { target: { value: "staff-2" } });

    const assignBtn = screen.getByRole("button", { name: "Assign" });
    fireEvent.click(assignBtn);

    await waitFor(() => {
      expect(api.assignTicket).toHaveBeenCalledWith(1, "staff-2");
    });
  });

  it("should change IT Priority and assert API call", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "NEW",
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
    (api.updateTicketPriority as any).mockResolvedValue({ message: "Success" });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const prioritySelect = screen.getByLabelText(/IT Priority/i);
    fireEvent.change(prioritySelect, { target: { value: "CRITICAL" } });

    const updateBtn = screen.getByRole("button", { name: "Update" });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(api.updateTicketPriority).toHaveBeenCalledWith(1, "CRITICAL");
    });
  });

  it("should trigger standard status transition and assert API call", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN", // OPEN allows RESOLVED
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

    const statusSelect = screen.getByLabelText(/Status Transition/i);
    fireEvent.change(statusSelect, { target: { value: "RESOLVED" } });

    const changeBtn = screen.getByRole("button", { name: "Change" });
    fireEvent.click(changeBtn);

    await waitFor(() => {
      expect(api.updateTicketStatus).toHaveBeenCalledWith(1, "RESOLVED", undefined);
    });
  });

  it("should submit a Public Comment and assert API call and UI update", async () => {
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
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    (api.getStaffTicketDetail as any).mockResolvedValueOnce(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: [] });
    (api.postTicketComment as any).mockResolvedValue({ data: { id: 1 } });

    // Mock subsequent fetch
    const updatedTicket = {
      ...mockTicket,
      publicComments: [
        { id: 1, body: "This is a public comment", author: { fullName: "Staff User", role: "IT_STAFF" }, createdAt: new Date().toISOString() }
      ]
    };
    (api.getStaffTicketDetail as any).mockResolvedValueOnce(updatedTicket);

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const publicTab = screen.getByRole("tab", { name: /Public Comment/i });
    await user.click(publicTab);

    const textarea = screen.getByPlaceholderText(/Write a public comment/i);
    await user.type(textarea, "This is a public comment");

    const postBtn = screen.getByRole("button", { name: /Post Comment/i });
    await user.click(postBtn);

    await waitFor(() => {
      expect(api.postTicketComment).toHaveBeenCalledWith(1, "This is a public comment");
    });

    await waitFor(() => {
      expect(screen.getByText("This is a public comment")).toBeInTheDocument();
    });
  });

  it("should submit an Internal Note and assert API call and UI update", async () => {
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
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    (api.getStaffTicketDetail as any).mockResolvedValueOnce(mockTicket);
    (api.getStaffAssignees as any).mockResolvedValue({ data: [] });
    (api.postInternalNote as any).mockResolvedValue({ data: { id: 1 } });

    // Mock subsequent fetch
    const updatedTicket = {
      ...mockTicket,
      internalNotes: [
        { id: 1, body: "This is an internal note", author: { fullName: "Staff User" }, createdAt: new Date().toISOString() }
      ]
    };
    (api.getStaffTicketDetail as any).mockResolvedValueOnce(updatedTicket);

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    const internalTab = screen.getByRole("tab", { name: /Internal Note/i });
    await user.click(internalTab);

    const textarea = screen.getByPlaceholderText(/Write an internal note/i);
    await user.type(textarea, "This is an internal note");

    const postBtn = screen.getByRole("button", { name: /Add Internal Note/i });
    await user.click(postBtn);

    await waitFor(() => {
      expect(api.postInternalNote).toHaveBeenCalledWith(1, "This is an internal note");
    });

    await waitFor(() => {
      expect(screen.getByText("This is an internal note")).toBeInTheDocument();
    });
  });
});
