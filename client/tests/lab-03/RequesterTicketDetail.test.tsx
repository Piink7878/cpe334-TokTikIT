import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RequesterTicketDetail } from "../../src/pages/RequesterTicketDetail";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../src/contexts/AuthContext";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual("../../src/api");
  return {
    ...actual,
    getTicket: vi.fn(),
    getPublicComments: vi.fn(),
    addPublicComment: vi.fn(),
    indicateProblemResolved: vi.fn()
  };
});

const mockUser = {
  id: "req-1",
  fullName: "Requester",
  email: "req@example.com",
  role: "REQUESTER"
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

describe("RequesterTicketDetail UI", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderComponent = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/my-tickets/1"]}>
          <Routes>
            <Route path="/my-tickets/:id" element={<RequesterTicketDetail />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it("should render Problem Appears Resolved button for non-terminal status", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN", // Non-terminal
      requester: { id: "req-1", name: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: []
    };

    (api.getTicket as any).mockResolvedValue({ data: mockTicket });
    (api.getPublicComments as any).mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      // It's rendered as readOnlyStyle with the value inside the div, but for inputs we should check by something else. We can just wait for INC-123.
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Problem Appears Resolved/i })).toBeInTheDocument();
  });

  it("should NOT render Problem Appears Resolved button for RESOLVED status", async () => {
    const mockTicket = {
      id: 1,
      ticketNumber: "INC-123",
      summary: "Cannot access VPN",
      description: "It says invalid password",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "RESOLVED", // Terminal
      requester: { id: "req-1", name: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: []
    };

    (api.getTicket as any).mockResolvedValue({ data: mockTicket });
    (api.getPublicComments as any).mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Problem Appears Resolved/i })).not.toBeInTheDocument();
  });

  it("should NOT render Internal Notes tabs", async () => {
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
      requester: { id: "req-1", name: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: []
    };

    (api.getTicket as any).mockResolvedValue({ data: mockTicket });
    (api.getPublicComments as any).mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("INC-123")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Internal Note/i)).not.toBeInTheDocument();
  });
});
