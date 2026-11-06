import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequesterDashboard from "../../src/pages/RequesterDashboard";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getRequesterDashboard: vi.fn() };
});

let currentUser: any;
vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser }) }));

const data = {
  totalTickets: 12,
  activeTickets: 4,
  waitingForRequesterTickets: 2,
  resolvedOrClosedTickets: 6,
  recentTickets: [
    { id: 7, ticketNumber: "TKT-1001", title: "VPN disconnects", currentStatus: "WAITING_FOR_REQUESTER", itPriority: "HIGH", updatedAt: "2026-11-01T10:00:00.000Z" },
    { id: 9, ticketNumber: "TKT-1004", title: "Switch port fix", currentStatus: "RESOLVED", itPriority: "MEDIUM", updatedAt: "2026-10-30T10:00:00.000Z" }
  ]
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <RequesterDashboard />
    </MemoryRouter>
  );

const card = (name: string) => screen.getByRole("link", { name: new RegExp(`^${name} \\d`) });

describe("Requester dashboard (Lab 4 Issue 5, FR-15)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { id: "req-1", fullName: "Req One", email: "req@example.com", role: "REQUESTER" };
  });

  it("shows the four metrics as cards that drill down to My Tickets (AC-10, AC-11)", async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({ data });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    await waitFor(() => expect(card("Total Tickets")).toBeInTheDocument());
    expect(card("Total Tickets")).toHaveAttribute("href", "/my-tickets");
    expect(card("Total Tickets")).toHaveTextContent("12");
    expect(card("Active Tickets")).toHaveAttribute("href", "/my-tickets?status=NEW,OPEN,IN_PROGRESS");
    expect(card("Active Tickets")).toHaveTextContent("4");
    expect(card("Waiting for Me")).toHaveAttribute("href", "/my-tickets?status=WAITING_FOR_REQUESTER");
    expect(card("Waiting for Me")).toHaveTextContent("2");
    expect(card("Resolved / Closed")).toHaveAttribute("href", "/my-tickets?status=RESOLVED,CLOSED");
    expect(card("Resolved / Closed")).toHaveTextContent("6");
  });

  it("lists recent tickets in a table with a View Ticket action, and in cards for narrow screens", async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({ data });
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Ticket #", "Title", "Status", "Priority", "Last Updated", "Action"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link", { name: "TKT-1001" })).toHaveAttribute("href", "/tickets/7");
    expect(within(rows[0]).getByRole("link", { name: "View ticket TKT-1001" })).toHaveAttribute("href", "/tickets/7");
    expect(within(rows[1]).getByRole("link", { name: "TKT-1004" })).toHaveAttribute("href", "/tickets/9");

    const cards = within(screen.getByRole("list")).getAllByRole("link");
    expect(cards.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["TKT-1001", "/tickets/7"],
      ["TKT-1004", "/tickets/9"]
    ]);
  });

  it("flags the ticket waiting for the requester with an amber badge and tooltip", async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({ data });
    renderPage();

    await screen.findByRole("table");
    const badges = screen.getAllByTitle("Requires your input");
    expect(badges).toHaveLength(2); // table row + narrow-screen card
    for (const badge of badges) {
      expect(badge).toHaveTextContent("WAITING FOR REQUESTER");
      expect(badge).toHaveStyle({ backgroundColor: "#FEF3C7" });
    }
  });

  it("shows zero metrics and the empty message when the requester has no tickets (AC-20)", async () => {
    (api.getRequesterDashboard as any).mockResolvedValue({
      data: { totalTickets: 0, activeTickets: 0, waitingForRequesterTickets: 0, resolvedOrClosedTickets: 0, recentTickets: [] }
    });
    renderPage();

    expect(await screen.findByText(/No recent ticket activity\. Submit a new ticket/)).toBeInTheDocument();
    expect(card("Total Tickets")).toHaveTextContent("0");
    expect(screen.getByRole("link", { name: "+ Create Ticket" })).toHaveAttribute("href", "/create-ticket");
  });

  it("shows a loading state while the request is pending", () => {
    (api.getRequesterDashboard as any).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText("Loading metrics")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Total Tickets \d/ })).not.toBeInTheDocument();
  });

  it("shows an error with a working Retry when the API fails", async () => {
    (api.getRequesterDashboard as any).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ data });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load dashboard metrics. Please try again.");
    expect(screen.queryByRole("link", { name: /^Total Tickets \d/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(card("Total Tickets")).toHaveTextContent("12"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["IT_STAFF", "ADMIN"])("shows 403 Forbidden to %s without calling the API", (role) => {
    currentUser = { ...currentUser, role };
    renderPage();
    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    expect(api.getRequesterDashboard).not.toHaveBeenCalled();
  });
});
