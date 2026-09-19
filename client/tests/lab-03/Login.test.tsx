import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Login from "../../src/pages/Login";
import { AuthProvider, useAuth } from "../../src/contexts/AuthContext";
import React from "react";

// Mock fetch
const mockFetch = vi.fn();
window.fetch = mockFetch;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{ui}</AuthProvider>
    </BrowserRouter>
  );
};

describe("Login Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should display validation errors from server", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes("/api/auth/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: false, json: async () => ({ error: { message: "Invalid email or password" } }) };
    });

    renderWithRouter(<Login />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("should successfully log in and call context login", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes("/api/auth/me")) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ user: { id: "123", email: "test@test.com", fullName: "Test User", role: "REQUESTER", mustChangePassword: false } }) };
    });

    renderWithRouter(<Login />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "TestPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", expect.any(Object));
    });
  });
});
