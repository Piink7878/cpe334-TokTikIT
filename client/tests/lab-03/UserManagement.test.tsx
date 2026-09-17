import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetUserPassword: vi.fn(),
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
    (api.createUser as any).mockResolvedValue({ id: "new", name: "New Guy" });
    (api.updateUser as any).mockResolvedValue({ id: "u1", name: "Alice Smith Updated" });
    (api.resetUserPassword as any).mockResolvedValue({ message: "Password reset successfully" });

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

  it("handles Create User interaction", async () => {
    const { container } = renderComponent();
    
    fireEvent.click(screen.getByRole("button", { name: /Create User/i }));
    
    await waitFor(() => {
      expect(screen.getByText("Create New User")).toBeInTheDocument();
    });
    
    const textInputs = container.querySelectorAll('input[type="text"]');
    const emailInputs = container.querySelectorAll('input[type="email"]');
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    
    fireEvent.change(textInputs[1], { target: { value: "New Guy" } });
    fireEvent.change(emailInputs[0], { target: { value: "new@example.com" } });
    fireEvent.change(passwordInputs[0], { target: { value: "Pass1234" } });
    
    const submitBtns = screen.getAllByRole("button", { name: /Create User/i });
    // Click the submit button (last one)
    fireEvent.click(submitBtns[submitBtns.length - 1]);
    
    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith({
        name: "New Guy",
        email: "new@example.com",
        role: "REQUESTER",
        password: "Pass1234",
        isActive: true,
      });
      expect(screen.getByText("User created successfully")).toBeInTheDocument();
    });
  });

  it("handles Edit User interaction", async () => {
    const { container } = renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    
    const editBtns = screen.getAllByRole("button", { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Edit Alice
    
    await waitFor(() => {
      expect(screen.getByText("Edit User")).toBeInTheDocument();
    });
    
    const textInputs = container.querySelectorAll('input[type="text"]');
    fireEvent.change(textInputs[1], { target: { value: "Alice Smith Updated" } });
    
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    
    await waitFor(() => {
      expect(api.updateUser).toHaveBeenCalledWith("u1", expect.objectContaining({
        name: "Alice Smith Updated",
      }));
      expect(screen.getByText("User updated successfully")).toBeInTheDocument();
    });
  });

  it("handles Reset Password interaction", async () => {
    const { container } = renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    
    const editBtns = screen.getAllByRole("button", { name: /Edit/i });
    fireEvent.click(editBtns[0]);
    
    await waitFor(() => {
      expect(screen.getByText("Edit User")).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole("button", { name: /Set New Initial Password/i }));
    
    await waitFor(() => {
      expect(screen.getAllByText("Reset Password").length).toBeGreaterThan(0);
    });
    
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordInputs[0], { target: { value: "NewPass123!" } });
    
    const submitBtns = screen.getAllByRole("button", { name: /Reset Password/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);
    
    await waitFor(() => {
      expect(api.resetUserPassword).toHaveBeenCalledWith("u1", "NewPass123!");
      expect(screen.getByText(/Password reset successfully/)).toBeInTheDocument();
    });
  });
});
