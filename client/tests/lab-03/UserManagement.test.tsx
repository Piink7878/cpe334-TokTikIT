import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UserManagement from "../../src/pages/UserManagement";
import { AuthProvider } from "../../src/contexts/AuthContext";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../src/api";

// Mock the API module
vi.mock("../../src/api", async () => {
  const actual = await vi.importActual("../../src/api");
  return {
    ...actual as any,
    getUsers: vi.fn(),
  };
});

describe("UserManagement Component", () => {
  const mockUser = {
    id: "admin-123",
    fullName: "System Admin",
    email: "admin@example.com",
    role: "ADMIN",
    mustChangePassword: false,
  };

  const mockUsersList = [
    {
      id: "u1",
      fullName: "Alice Smith",
      email: "alice@example.com",
      role: "REQUESTER",
      isActive: true,
    },
    {
      id: "u2",
      fullName: "Bob Jones",
      email: "bob@example.com",
      role: "IT_STAFF",
      isActive: false,
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getUsers as any).mockResolvedValue({
      data: mockUsersList,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser }),
    }) as any;
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <UserManagement />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it("renders search bar, role filter, and user list correctly", async () => {
    renderComponent();
    
    // Verify search bar and role filter
    expect(screen.getByPlaceholderText("Search by name or email...")).toBeInTheDocument();
    
    // Check role filter options
    expect(screen.getByText("All Roles")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByText("IT Staff")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();

    // Verify user list renders
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
    
    // Verify badges and active state
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});
