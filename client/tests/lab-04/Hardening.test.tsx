import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import AppLayout from "../../src/components/AppLayout";
import Login from "../../src/pages/Login";
import UserManagement from "../../src/pages/UserManagement";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getUsers: vi.fn(),
    createUser: vi.fn(),
    getStaffTicketDetail: vi.fn(),
    getStaffAssignees: vi.fn(),
    claimTicket: vi.fn(),
    updateTicketStatus: vi.fn(),
    getActionsTaken: vi.fn()
  };
});

const loginSpy = vi.fn();
const logoutSpy = vi.fn();
let currentUser: any;
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser, login: loginSpy, logout: logoutSpy, updateUser: vi.fn() })
}));

describe("application hardening (Lab 4 Issue 6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { id: "staff-1", fullName: "IT Staff", email: "staff@example.com", role: "IT_STAFF" };
  });

  describe("navigation shell", () => {
    const renderShell = () =>
      render(
        <MemoryRouter initialEntries={["/staff-dashboard"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/staff-dashboard" element={<Link to="/staff-queue">go</Link>} />
              <Route path="/staff-queue" element={<div>queue page</div>} />
              <Route path="/login" element={<div>login page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

    it("has a menu toggle that opens and closes the navigation, and closes it after navigating", () => {
      renderShell();
      const toggle = screen.getByRole("button", { name: "Toggle navigation" });
      const menu = document.getElementById("main-nav")!;

      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(menu).not.toHaveClass("show");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(menu).toHaveClass("show");

      fireEvent.click(within(menu).getByRole("link", { name: "Ticket Queue" }));
      expect(screen.getByText("queue page")).toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(document.getElementById("main-nav")).not.toHaveClass("show");
    });

    it("sends the brand link to the role's home instead of a requester page", () => {
      renderShell();
      expect(screen.getByRole("link", { name: "TokTickIT" })).toHaveAttribute("href", "/");
    });

    it.each([
      ["the session already expired (401)", () => Promise.resolve({ ok: false, status: 401, json: async () => ({}) })],
      ["the network is down", () => Promise.reject(new TypeError("Failed to fetch"))]
    ])("logs out locally and leaves the app when %s", async (_name, answer) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockImplementation(answer) as any;
      renderShell();

      fireEvent.click(screen.getByRole("button", { name: "Logout" }));

      await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("login failures", () => {
    const renderLogin = () =>
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    const submitWith = () => {
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "me@example.com" } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Secret123!" } });
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    };

    it("explains a network failure in plain words and keeps what was typed", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;
      renderLogin();
      submitWith();

      expect(await screen.findByText(api.NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toHaveValue("me@example.com");
      expect(screen.getByLabelText(/password/i)).toHaveValue("Secret123!");
    });

    it("does not show a JSON parse error when the server answers with a non-JSON error page", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("Unexpected token <"); } }) as any;
      renderLogin();
      submitWith();

      expect(await screen.findByText("Login failed. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
    });
  });

  describe("duplicate submissions on the staff ticket page", () => {
    const ticket = {
      id: 1,
      ticketNumber: "INC-1",
      summary: "VPN down",
      description: "Cannot connect",
      category: { id: 1, name: "Network" },
      relatedSystem: { id: 1, name: "VPN" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      owner: null,
      createdAt: "2026-10-30T09:00:00.000Z",
      updatedAt: "2026-10-30T10:00:00.000Z",
      attachments: [],
      publicComments: [],
      internalNotes: []
    };

    const renderTicket = async () => {
      (api.getStaffTicketDetail as any).mockResolvedValue(ticket);
      (api.getStaffAssignees as any).mockResolvedValue({ data: [] });
      (api.getActionsTaken as any).mockResolvedValue({ data: [] });
      render(
        <MemoryRouter initialEntries={["/staff/tickets/1"]}>
          <Routes>
            <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
          </Routes>
        </MemoryRouter>
      );
      await screen.findByText("INC-1");
    };

    it("sends one claim request for a double click and disables the buttons while it runs", async () => {
      let finish: (v?: unknown) => void = () => {};
      (api.claimTicket as any).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await renderTicket();

      const claim = screen.getByRole("button", { name: /Claim Ticket/ });
      fireEvent.click(claim);
      fireEvent.click(claim);

      expect(api.claimTicket).toHaveBeenCalledTimes(1);
      expect(claim).toBeDisabled();
      expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();

      finish({});
      await waitFor(() => expect(screen.getByText("Ticket claimed successfully")).toBeInTheDocument());
    });

    it("sends one status change for a double click, so the stale-update check never misreports it", async () => {
      let finish: (v?: unknown) => void = () => {};
      (api.updateTicketStatus as any).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await renderTicket();

      fireEvent.change(screen.getByLabelText(/Status Transition/i), { target: { value: "IN_PROGRESS" } });
      const change = screen.getByRole("button", { name: "Change" });
      fireEvent.click(change);
      fireEvent.click(change);

      expect(api.updateTicketStatus).toHaveBeenCalledTimes(1);
      finish({});
      await waitFor(() => expect(screen.getByText("Status updated successfully")).toBeInTheDocument());
      expect(screen.queryByText(/changed by someone else/)).not.toBeInTheDocument();
    });

    it("ignores a second action that starts before the page has re-rendered (two controls, one batch)", async () => {
      (api.claimTicket as any).mockReturnValue(new Promise(() => {}));
      await renderTicket();
      fireEvent.change(screen.getByLabelText(/Status Transition/i), { target: { value: "IN_PROGRESS" } });
      const claim = screen.getByRole("button", { name: /Claim Ticket/ });
      const change = screen.getByRole("button", { name: "Change" });

      // Both clicks land before React can disable either button.
      act(() => {
        fireEvent.click(claim);
        fireEvent.click(change);
      });

      expect(api.claimTicket).toHaveBeenCalledTimes(1);
      expect(api.updateTicketStatus).not.toHaveBeenCalled();
    });

    it("allows the next action once the first has finished", async () => {
      (api.claimTicket as any).mockResolvedValue({});
      await renderTicket();

      fireEvent.click(screen.getByRole("button", { name: /Claim Ticket/ }));
      await waitFor(() => expect(screen.getByText("Ticket claimed successfully")).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole("button", { name: /Claim Ticket/ })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: /Claim Ticket/ }));
      await waitFor(() => expect(api.claimTicket).toHaveBeenCalledTimes(2));
    });
  });

  describe("user management dialogs", () => {
    beforeEach(() => {
      currentUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "ADMIN" };
      (api.getUsers as any).mockResolvedValue({ data: [{ id: "u1", fullName: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true }] });
    });

    it("shows a server rejection inside the open dialog, keeps the typed values and makes the page behind inert", async () => {
      (api.createUser as any).mockRejectedValue(new Error("Email already exists"));
      render(
        <MemoryRouter>
          <UserManagement />
        </MemoryRouter>
      );
      fireEvent.click(await screen.findByRole("button", { name: /Create User/ }));

      const dialog = screen.getByRole("dialog", { name: /Create New User/ });
      fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Carol" } });
      fireEvent.change(within(dialog).getByLabelText("Email Address"), { target: { value: "alice@example.com" } });
      fireEvent.change(within(dialog).getByLabelText("Initial Password"), { target: { value: "Password123!" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /Create User|Create/, hidden: false }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Email already exists");
      expect(screen.getAllByRole("alert")).toHaveLength(1); // not duplicated behind the dialog
      expect(within(dialog).getByLabelText("Full Name")).toHaveValue("Carol");
      expect(within(dialog).getByLabelText("Email Address")).toHaveValue("alice@example.com");
      expect(within(dialog).getByLabelText("Initial Password")).toHaveValue("Password123!");
      expect(document.querySelector("[inert]")).not.toBeNull();
      expect(dialog.closest("[inert]")).toBeNull();
    });

    it("gives the dialog's close button an accessible name and leaves the page interactive when no dialog is open", async () => {
      render(
        <MemoryRouter>
          <UserManagement />
        </MemoryRouter>
      );
      await screen.findByText("Alice");
      expect(document.querySelector("[inert]")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /Create User/ }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.querySelector("[inert]")).toBeNull();
    });
  });
});
