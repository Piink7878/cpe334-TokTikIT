import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import MyTickets from "../../src/pages/MyTickets";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue";
import AppLayout from "../../src/components/AppLayout";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return { ...actual, getTickets: vi.fn(), getStaffTickets: vi.fn(), getCategories: vi.fn() };
});

let currentUser: any;
vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser, logout: vi.fn() }) }));

const emptyPage = { data: [], pagination: { page: 1, pageSize: 8, limit: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };

describe("dashboard drill-down targets (Lab 4 Issue 5)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (api.getCategories as any).mockResolvedValue([]);
    (api.getTickets as any).mockResolvedValue(emptyPage);
    (api.getStaffTickets as any).mockResolvedValue(emptyPage);
  });

  describe("My Tickets", () => {
    beforeEach(() => {
      currentUser = { id: "req-1", fullName: "Req One", role: "REQUESTER" };
    });

    const renderAt = (url: string) =>
      render(
        <MemoryRouter initialEntries={[url]}>
          <MyTickets />
        </MemoryRouter>
      );

    it("loads the list filtered by every status in the URL and names the selection", async () => {
      renderAt("/my-tickets?status=NEW,OPEN,IN_PROGRESS");
      await waitFor(() => expect(api.getTickets).toHaveBeenCalled());

      expect((api.getTickets as any).mock.calls[0][0]).toMatchObject({ status: "NEW,OPEN,IN_PROGRESS" });
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveDisplayValue("New, Open, In progress");
    });

    it("applies a single status from the URL to the dropdown", async () => {
      renderAt("/my-tickets?status=WAITING_FOR_REQUESTER");
      await waitFor(() => expect(api.getTickets).toHaveBeenCalled());

      expect((api.getTickets as any).mock.calls[0][0]).toMatchObject({ status: "WAITING_FOR_REQUESTER" });
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveDisplayValue("Waiting for Requester");
    });

    it("applies no status filter without a query string, and the user can still pick one", async () => {
      renderAt("/my-tickets");
      await waitFor(() => expect(api.getTickets).toHaveBeenCalled());
      expect((api.getTickets as any).mock.calls[0][0].status).toBeUndefined();

      fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { name: "status", value: "REOPENED" } });
      await waitFor(() => expect((api.getTickets as any).mock.calls.at(-1)[0]).toMatchObject({ status: "REOPENED" }));
    });
  });

  describe("Staff queue", () => {
    beforeEach(() => {
      currentUser = { id: "staff-1", fullName: "IT Staff", role: "IT_STAFF" };
    });

    const renderAt = (url: string) =>
      render(
        <MemoryRouter initialEntries={[url]}>
          <StaffTicketQueue />
        </MemoryRouter>
      );

    const lastFilters = () => (api.getStaffTickets as any).mock.calls.at(-1)[0];

    it("My Active Tickets: ownerId=me becomes the signed-in user and the status set is kept", async () => {
      renderAt("/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());

      expect(lastFilters()).toMatchObject({ ownerId: "staff-1", status: "OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED" });
      expect(screen.getByDisplayValue("My Tickets")).toBeInTheDocument();
    });

    it("Unassigned: sends ownerId=unassigned with the NEW,OPEN status set", async () => {
      renderAt("/staff-queue?ownerId=unassigned&status=NEW,OPEN");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());
      expect(lastFilters()).toMatchObject({ ownerId: "unassigned", status: "NEW,OPEN" });
    });

    it("Critical / High: sends both priorities", async () => {
      renderAt("/staff-queue?itPriority=CRITICAL,HIGH&status=NEW,OPEN");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());
      expect(lastFilters()).toMatchObject({ itPriority: "CRITICAL,HIGH", status: "NEW,OPEN" });
    });

    it("Follow-Up Required: sends followUpRequired, shows it as a ticked filter and clears it with Reset", async () => {
      renderAt("/staff-queue?followUpRequired=true&status=NEW,OPEN");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());

      expect(lastFilters()).toMatchObject({ followUpRequired: true, status: "NEW,OPEN" });
      expect(screen.getByLabelText("Follow-up required")).toBeChecked();

      // The empty result set offers the reset button, which must drop the hidden-looking filter too.
      fireEvent.click(await screen.findByRole("button", { name: /Clear Filters/ }));
      await waitFor(() => expect(lastFilters().followUpRequired).toBeUndefined());
      expect(screen.getByLabelText("Follow-up required")).not.toBeChecked();
    });

    it("a status badge link filters by that single status", async () => {
      renderAt("/staff-queue?status=REJECTED");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());
      expect(lastFilters()).toMatchObject({ status: "REJECTED" });
      expect(screen.getByDisplayValue("Rejected")).toBeInTheDocument();
    });

    it("follows the URL when it changes while the page stays mounted, e.g. the nav link back to the plain queue", async () => {
      render(
        <MemoryRouter initialEntries={["/staff-queue"]}>
          <Link to="/staff-queue?followUpRequired=true&status=NEW,OPEN&itPriority=CRITICAL,HIGH&ownerId=me">drill</Link>
          <Link to="/staff-queue">plain</Link>
          <Routes>
            <Route path="/staff-queue" element={<StaffTicketQueue />} />
          </Routes>
        </MemoryRouter>
      );
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());
      expect(lastFilters().followUpRequired).toBeUndefined();

      fireEvent.click(screen.getByRole("link", { name: "drill" }));
      await waitFor(() =>
        expect(lastFilters()).toMatchObject({ followUpRequired: true, status: "NEW,OPEN", itPriority: "CRITICAL,HIGH", ownerId: "staff-1" })
      );

      fireEvent.click(screen.getByRole("link", { name: "plain" }));
      await waitFor(() => expect(lastFilters().followUpRequired).toBeUndefined());
      expect(lastFilters().status).toBeUndefined();
      expect(lastFilters().itPriority).toBeUndefined();
      expect(lastFilters().ownerId).toBeUndefined();
    });

    it("has no extra filters when opened without a query string", async () => {
      renderAt("/staff-queue");
      await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalled());
      const f = lastFilters();
      expect(f.status).toBeUndefined();
      expect(f.ownerId).toBeUndefined();
      expect(f.followUpRequired).toBeUndefined();
    });
  });
});

describe("role-aware navigation (ui-spec §1.2)", () => {
  const navLinks = (role: string) => {
    currentUser = { id: "u-1", fullName: "Someone", email: "s@example.com", role };
    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/x" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    return Array.from(document.querySelectorAll("ul.navbar-nav a")).map((a) => [a.textContent, a.getAttribute("href")]);
  };

  it("gives a Requester Dashboard, My Tickets and Create Ticket", () => {
    expect(navLinks("REQUESTER")).toEqual([
      ["Dashboard", "/requester-dashboard"],
      ["My Tickets", "/my-tickets"],
      ["Create Ticket", "/create-ticket"],
      ["Health", "/health"]
    ]);
  });

  it("gives IT Staff Dashboard and Ticket Queue", () => {
    expect(navLinks("IT_STAFF")).toEqual([
      ["Dashboard", "/staff-dashboard"],
      ["Ticket Queue", "/staff-queue"],
      ["Health", "/health"]
    ]);
  });

  it("gives an Administrator Staff Dashboard, Ticket Queue and User Management", () => {
    expect(navLinks("ADMIN")).toEqual([
      ["Staff Dashboard", "/staff-dashboard"],
      ["Ticket Queue", "/staff-queue"],
      ["User Management", "/user-management"],
      ["Health", "/health"]
    ]);
  });
});
