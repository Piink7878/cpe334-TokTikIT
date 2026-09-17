import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import UserManagement from "../../src/pages/admin/UserManagement";
import * as api from "../../src/api";

// Mock the AuthContext
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" }
  })
}));

// Mock the API calls
vi.mock("../../src/api", () => ({
  getAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  resetAdminUserPassword: vi.fn(),
}));

describe("UserManagement Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", async () => {
    vi.mocked(api.getAdminUsers).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
    });

    render(<UserManagement />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
  });

  it("should render users table", async () => {
    vi.mocked(api.getAdminUsers).mockResolvedValueOnce({
      data: [
        { id: "1", fullName: "Test User", email: "test@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true, createdAt: "", updatedAt: "" },
        { id: "2", fullName: "Staff User", email: "staff@example.com", role: "IT_STAFF", isActive: false, mustChangePassword: false, createdAt: "", updatedAt: "" }
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("Staff User")).toBeInTheDocument();
    });
  });

  it("should open create user modal", async () => {
    vi.mocked(api.getAdminUsers).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
    });

    render(<UserManagement />);
    await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
    
    fireEvent.click(screen.getByText("Create User"));
    
    expect(screen.getByText("Create User", { selector: 'h5' })).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  it("should open edit user modal", async () => {
    vi.mocked(api.getAdminUsers).mockResolvedValueOnce({
      data: [
        { id: "1", fullName: "Test User", email: "test@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true, createdAt: "", updatedAt: "" }
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
    });

    render(<UserManagement />);
    await waitFor(() => expect(screen.queryByText("Loading...")).not.toBeInTheDocument());
    
    const editBtns = screen.getAllByText("Edit");
    fireEvent.click(editBtns[0]);
    
    expect(screen.getByText("Edit User", { selector: 'h5' })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });
});
