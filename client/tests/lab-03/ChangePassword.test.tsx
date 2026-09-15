import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ChangePassword from "../../src/pages/ChangePassword";
import { AuthProvider } from "../../src/contexts/AuthContext";
import React from "react";

const mockFetch = vi.fn();
window.fetch = mockFetch;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{ui}</AuthProvider>
    </BrowserRouter>
  );
};

describe("ChangePassword Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should require matching passwords", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes("/api/auth/me")) return { ok: false, json: async () => ({}) };
      return { ok: true };
    });
    renderWithRouter(<ChangePassword />);
    
    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: "OldPass123!" } });
    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: "NewPass123!@" } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: "DifferentPass!" } });
    
    fireEvent.click(screen.getByRole("button", { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByText("New password and confirm password must match.")).toBeInTheDocument();
    });
    
    expect(mockFetch).not.toHaveBeenCalledWith("/api/auth/change-password", expect.any(Object));
  });

  it("should display server errors on failed password update", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes("/api/auth/me")) return { ok: false, json: async () => ({}) };
      return { ok: false, json: async () => ({ error: { message: "Invalid current password" } }) };
    });

    renderWithRouter(<ChangePassword />);
    
    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: "WrongOldPass!" } });
    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: "NewPass123!@" } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: "NewPass123!@" } });
    
    fireEvent.click(screen.getByRole("button", { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid current password")).toBeInTheDocument();
    });
  });

  it("should submit password change successfully", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes("/api/auth/me")) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => ({ message: "Password updated successfully" }) };
    });

    renderWithRouter(<ChangePassword />);
    
    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: "OldPass123!" } });
    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: "NewPass123!@" } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: "NewPass123!@" } });
    
    fireEvent.click(screen.getByRole("button", { name: /Update Password/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/change-password", expect.any(Object));
    });
  });
});
