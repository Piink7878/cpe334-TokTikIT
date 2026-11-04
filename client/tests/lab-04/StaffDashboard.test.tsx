import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffDashboard from "../../src/pages/StaffDashboard";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getStaffDashboard: vi.fn() };
});

let currentUser: any;
vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser }) }));

const UNRESOLVED = "NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED";

const data = {
  unassignedTickets: 5,
  myActiveTickets: 3,
  ticketsRequiringFollowUp: 2,
  criticalOrHighPriorityTickets: 4,
  statusBreakdown: { NEW: 3, OPEN: 2, IN_PROGRESS: 5, WAITING_FOR_REQUESTER: 2, RESOLVED: 8, CLOSED: 14, REOPENED: 1, CANCELLED: 2, REJECTED: 1 },
  recentTickets: [
    { id: 3, ticketNumber: "TKT-1003", title: "Core router flap", currentStatus: "OPEN", itPriority: "CRITICAL", ownerId: null, updatedAt: "2026-11-01T10:00:00.000Z" },
    { id: 1, ticketNumber: "TKT-1001", title: "Mail queue stuck", currentStatus: "IN_PROGRESS", itPriority: "HIGH", ownerId: "staff-1", updatedAt: "2026-10-31T10:00:00.000Z" }
  ],
  currentUserActions: [
    { id: 11, ticketId: 1, ticketNumber: "TKT-1001", description: "Restarted the mail daemon", result: "Queue draining", actionDateTime: "2026-10-31T09:00:00.000Z", followUpRequired: true }
  ]
};

const emptyData = {
  unassignedTickets: 0,
  myActiveTickets: 0,
  ticketsRequiringFollowUp: 0,
  criticalOrHighPriorityTickets: 0,
  statusBreakdown: Object.fromEntries(Object.keys(data.statusBreakdown).map((s) => [s, 0])),
  recentTickets: [],
  currentUserActions: []
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <StaffDashboard />
    </MemoryRouter>
  );

const card = (name: string) => screen.getByRole("link", { name: new RegExp(`^${name}:`) });

describe("IT Staff dashboard (Lab 4 Issue 5, FR-16)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { id: "staff-1", fullName: "IT Staff", email: "staff@example.com", role: "IT_STAFF" };
  });

  it("shows the four metric cards with the drill-down targets of specification §8.2", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    renderPage();

    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    expect(card("Unassigned Tickets")).toHaveAttribute("href", "/staff-queue?ownerId=unassigned&status=NEW,OPEN");
    expect(card("Unassigned Tickets")).toHaveTextContent("5");
    expect(card("My Active Tickets")).toHaveAttribute("href", "/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED");
    expect(card("My Active Tickets")).toHaveTextContent("3");
    expect(card("Follow-Up Required")).toHaveAttribute("href", `/staff-queue?followUpRequired=true&status=${UNRESOLVED}`);
    expect(card("Follow-Up Required")).toHaveTextContent("2");
    expect(card("Critical / High Priority")).toHaveAttribute("href", `/staff-queue?itPriority=CRITICAL,HIGH&status=${UNRESOLVED}`);
    expect(card("Critical / High Priority")).toHaveTextContent("4");
  });

  it("shows all nine statuses as badges linking to the queue filtered by that status", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    renderPage();

    const section = (await screen.findByRole("heading", { name: "Queue Status Breakdown" })).closest("section")!;
    const badges = within(section).getAllByRole("link");
    expect(badges).toHaveLength(9);
    for (const [status, count] of Object.entries(data.statusBreakdown)) {
      const badge = within(section).getByRole("link", { name: `${status.replace(/_/g, " ")}: ${count}` });
      expect(badge).toHaveAttribute("href", `/staff-queue?status=${status}`);
    }
  });

  it("lists recent queue tickets and the user's actions with links to the staff ticket detail", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    renderPage();

    const queue = (await screen.findByRole("heading", { name: "Recent Queue Tickets" })).closest("section")!;
    expect(within(queue).getByRole("link", { name: "TKT-1003" })).toHaveAttribute("href", "/staff/tickets/3");
    expect(within(queue).getByText("Core router flap")).toBeInTheDocument();
    expect(within(queue).getByText("CRITICAL")).toBeInTheDocument();
    expect(within(queue).getByText("Unassigned")).toBeInTheDocument();
    expect(within(queue).getByText("Assigned")).toBeInTheDocument();

    const actions = screen.getByRole("heading", { name: "My Recent Actions Taken" }).closest("section")!;
    expect(within(actions).getByRole("link", { name: "TKT-1001" })).toHaveAttribute("href", "/staff/tickets/1");
    expect(within(actions).getByText("Restarted the mail daemon")).toBeInTheDocument();
    expect(within(actions).getByText("Follow-Up Required")).toBeInTheDocument();
  });

  it("shows zero metrics and empty messages for a technician with nothing to show (AC-20)", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data: emptyData });
    renderPage();

    expect(await screen.findByText("No recent tickets in queue.")).toBeInTheDocument();
    expect(screen.getByText(/No actions recorded yet/)).toBeInTheDocument();
    expect(card("My Active Tickets")).toHaveTextContent("0");
  });

  it("shows a loading state while the request is pending", () => {
    (api.getStaffDashboard as any).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText("Loading metrics")).toBeInTheDocument();
  });

  it("shows an error with a working Retry when the API fails", async () => {
    (api.getStaffDashboard as any).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ data });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard metrics. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(card("Unassigned Tickets")).toHaveTextContent("5"));
  });

  it("shows 403 Forbidden to a Requester without calling the API", () => {
    currentUser = { ...currentUser, role: "REQUESTER" };
    renderPage();
    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    expect(api.getStaffDashboard).not.toHaveBeenCalled();
  });

  it("shows the governance note to an Administrator only (BR-16)", async () => {
    (api.getStaffDashboard as any).mockResolvedValue({ data });
    currentUser = { ...currentUser, role: "ADMIN" };
    const { unmount } = renderPage();
    expect(await screen.findByRole("note")).toHaveTextContent(/Administrator view/);
    expect(screen.getByRole("link", { name: "User Management" })).toHaveAttribute("href", "/user-management");
    unmount();

    currentUser = { ...currentUser, role: "IT_STAFF" };
    renderPage();
    await screen.findByRole("heading", { name: "IT Staff Dashboard" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
