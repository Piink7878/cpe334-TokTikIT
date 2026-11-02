import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getStaffTicketDetail: vi.fn(),
    getStaffAssignees: vi.fn(),
    claimTicket: vi.fn(),
    assignTicket: vi.fn(),
    updateTicketPriority: vi.fn(),
    updateTicketStatus: vi.fn(),
    getActionsTaken: vi.fn(),
    createActionTaken: vi.fn(),
    updateActionTaken: vi.fn()
  };
});

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "staff-1", fullName: "IT Staff", email: "staff@example.com", role: "IT_STAFF" } })
}));

// specification.md §6.1 — the approved transition matrix the dropdown must mirror exactly.
const MATRIX: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED", "REJECTED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  REJECTED: []
};

const ticketWith = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 1,
  ticketNumber: "INC-123",
  summary: "Cannot access VPN",
  description: "It says invalid password",
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 1, name: "VPN" },
  requestedPriority: "HIGH",
  itPriority: "HIGH",
  status,
  requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
  owner: { id: "staff-2", fullName: "Other Staff", email: "other@example.com" },
  createdAt: "2026-10-30T09:00:00.000Z",
  updatedAt: "2026-10-30T10:00:00.000Z",
  attachments: [],
  publicComments: [],
  internalNotes: [],
  ...extra
});

const anAction = {
  id: 1,
  ticketId: 1,
  description: "Replaced the faulty switch",
  result: "Link restored",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  assignedToId: null,
  assignedTo: null,
  performedById: "staff-2",
  performedBy: { id: "staff-2", fullName: "Other Staff", role: "IT_STAFF" },
  actionDateTime: "2026-10-30T09:30:00.000Z",
  createdAt: "2026-10-30T09:30:00.000Z",
  updatedAt: "2026-10-30T09:30:00.000Z",
  revisions: []
};

const renderPage = async (status: string, actions: unknown[] = [anAction]) => {
  (api.getStaffTicketDetail as any).mockResolvedValue(ticketWith(status));
  (api.getStaffAssignees as any).mockResolvedValue({ data: [] });
  (api.getActionsTaken as any).mockResolvedValue({ data: actions });
  render(
    <MemoryRouter initialEntries={["/staff/tickets/1"]}>
      <Routes>
        <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText("INC-123");
  // Wait for the Actions Taken section to settle so its count has reached the page.
  await screen.findByRole("heading", { name: /Service Actions \(/ });
};

const statusSelect = () => screen.queryByRole("combobox", { name: /Status Transition/i }) as HTMLSelectElement | null;
const chooseStatus = (value: string) => fireEvent.change(statusSelect()!, { target: { value } });

describe("Staff ticket workflow UI (Lab 4 Issue 4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("status dropdown mirrors the approved matrix", () => {
    it.each(Object.keys(MATRIX).filter((s) => MATRIX[s].length > 0))("offers exactly the permitted destinations from %s", async (from) => {
      await renderPage(from);
      const offered = Array.from(statusSelect()!.querySelectorAll("option"))
        .map((o) => o.value)
        .filter((v) => v !== from);
      expect(offered.sort()).toEqual([...MATRIX[from]].sort());
    });
  });

  describe("terminal tickets (BR-08)", () => {
    it.each(["CLOSED", "CANCELLED", "REJECTED"])("offers no transition and locks assignment and priority on a %s ticket", async (status) => {
      await renderPage(status);

      expect(statusSelect()).toBeNull();
      expect(screen.getByText(new RegExp(`No further transitions allowed from ${status}`))).toBeInTheDocument();
      expect(document.getElementById("assignee-select")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
      expect(document.getElementById("priority-select")).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Claim Ticket/i })).not.toBeInTheDocument();
    });

    it("keeps assignment and priority enabled on a non-terminal ticket", async () => {
      await renderPage("RESOLVED");
      expect(document.getElementById("assignee-select")).toBeEnabled();
      expect(document.getElementById("priority-select")).toBeEnabled();
    });
  });

  describe("Resolution Gate feedback (BR-10)", () => {
    it("warns when RESOLVED is chosen on a ticket with no Action Taken", async () => {
      await renderPage("IN_PROGRESS", []);
      expect(screen.queryByText(/Resolution Gate/)).not.toBeInTheDocument();

      chooseStatus("RESOLVED");
      expect(screen.getByText(/Resolution Gate: record at least one Action Taken/)).toBeInTheDocument();

      chooseStatus("WAITING_FOR_REQUESTER");
      expect(screen.queryByText(/Resolution Gate/)).not.toBeInTheDocument();
    });

    it("does not warn when the ticket already has an Action Taken", async () => {
      await renderPage("IN_PROGRESS");
      chooseStatus("RESOLVED");
      expect(screen.queryByText(/Resolution Gate/)).not.toBeInTheDocument();
    });

    it("shows a clear message when the backend rejects with ACTION_TAKEN_REQUIRED, and keeps the old status", async () => {
      await renderPage("IN_PROGRESS", []);
      (api.updateTicketStatus as any).mockRejectedValue(
        new api.ApiError("At least one Action Taken is required.", 400, "ACTION_TAKEN_REQUIRED")
      );

      chooseStatus("RESOLVED");
      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      expect(await screen.findByText("Record at least one Action Taken before resolving this ticket.")).toBeInTheDocument();
      expect(screen.queryByText("Status updated successfully")).not.toBeInTheDocument();
      expect(statusSelect()!.querySelector("option[disabled]")).toHaveValue("IN_PROGRESS");
    });
  });

  describe("status change feedback", () => {
    it("sends the last-seen updatedAt, then refreshes the summary in place without reloading the Actions Taken section", async () => {
      await renderPage("OPEN");
      (api.updateTicketStatus as any).mockResolvedValue({ message: "Status updated successfully" });
      (api.getStaffTicketDetail as any).mockResolvedValue(ticketWith("IN_PROGRESS", { updatedAt: "2026-10-30T11:00:00.000Z" }));

      chooseStatus("IN_PROGRESS");
      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      expect(await screen.findByText("Status updated successfully")).toBeInTheDocument();
      expect(api.updateTicketStatus).toHaveBeenCalledWith(1, "IN_PROGRESS", undefined, "2026-10-30T10:00:00.000Z");
      await waitFor(() => expect(statusSelect()!.querySelector("option[disabled]")).toHaveValue("IN_PROGRESS"));
      expect(api.getActionsTaken).toHaveBeenCalledTimes(1);
    });

    it("explains a 409 conflict and shows the latest ticket state", async () => {
      await renderPage("OPEN");
      (api.updateTicketStatus as any).mockRejectedValue(new api.ApiError("conflict", 409, "CONCURRENCY_CONFLICT"));
      (api.getStaffTicketDetail as any).mockResolvedValue(ticketWith("IN_PROGRESS", { updatedAt: "2026-10-30T11:00:00.000Z" }));

      chooseStatus("CANCELLED");
      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
      expect(screen.queryByText("Status updated successfully")).not.toBeInTheDocument();
      expect(statusSelect()!.querySelector("option[disabled]")).toHaveValue("IN_PROGRESS");
    });

    it("falls back to the server message for other failures", async () => {
      await renderPage("OPEN");
      (api.updateTicketStatus as any).mockRejectedValue(new api.ApiError("Invalid transition from OPEN to NEW", 400, "INVALID_STATUS_TRANSITION"));

      chooseStatus("CANCELLED");
      fireEvent.click(screen.getByRole("button", { name: "Change" }));

      expect(await screen.findByText("Invalid transition from OPEN to NEW")).toBeInTheDocument();
    });
  });
});
