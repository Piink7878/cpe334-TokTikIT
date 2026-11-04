import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CreateTicket from "../../src/pages/CreateTicket";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import { RequesterTicketDetail } from "../../src/pages/RequesterTicketDetail";
import { createKeyTracker } from "../../src/idempotency";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getCategories: vi.fn(),
    getRelatedSystems: vi.fn(),
    createTicket: vi.fn(),
    addPublicComment: vi.fn(),
    addInternalNote: vi.fn(),
    getStaffTicketDetail: vi.fn(),
    getStaffAssignees: vi.fn(),
    getActionsTaken: vi.fn(),
    getTicket: vi.fn(),
    getPublicComments: vi.fn()
  };
});

let currentUser: any;
vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: currentUser }) }));

const keyOf = (mock: any, call: number, argIndex: number) => mock.mock.calls[call][argIndex] as string;

describe("retry-safe submissions (Idempotency-Key)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { id: "u-1", fullName: "Test User", email: "test@example.com", role: "REQUESTER" };
  });

  describe("key tracker", () => {
    it("keeps the key for the same content, replaces it when the content changes, and starts fresh after a reset", () => {
      const tracker = createKeyTracker();
      const first = tracker.keyFor("hello");
      expect(tracker.keyFor("hello")).toBe(first);
      const changed = tracker.keyFor("hello world");
      expect(changed).not.toBe(first);
      expect(tracker.keyFor("hello world")).toBe(changed);
      tracker.reset();
      expect(tracker.keyFor("hello world")).not.toBe(changed);
    });

    it("produces keys the server accepts (8-128 characters, letters/digits/._:-)", () => {
      expect(createKeyTracker().keyFor("x")).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    });
  });

  describe("API client", () => {
    afterEach(() => vi.unstubAllGlobals());

    const stubFetch = () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    };

    it("sends the Idempotency-Key header on ticket, comment and note creation only when a key is given", async () => {
      const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
      const fetchMock = stubFetch();

      await actual.createTicket(new FormData(), "key-for-ticket-1");
      await actual.addPublicComment(5, "hello", "key-for-comment");
      await actual.addInternalNote(5, "note", "key-for-note-1");
      const headers = fetchMock.mock.calls.map((c) => c[1].headers);
      expect(headers[0]).toEqual({ "Idempotency-Key": "key-for-ticket-1" });
      expect(headers[1]).toEqual({ "Content-Type": "application/json", "Idempotency-Key": "key-for-comment" });
      expect(headers[2]).toEqual({ "Content-Type": "application/json", "Idempotency-Key": "key-for-note-1" });

      fetchMock.mockClear();
      await actual.createTicket(new FormData());
      await actual.addPublicComment(5, "hello");
      expect(fetchMock.mock.calls[0][1].headers).toEqual({});
      expect(fetchMock.mock.calls[1][1].headers).toEqual({ "Content-Type": "application/json" });
    });
  });

  describe("create ticket", () => {
    const fillForm = async () => {
      (api.getCategories as any).mockResolvedValue([{ id: 1, name: "Hardware" }]);
      (api.getRelatedSystems as any).mockResolvedValue([{ id: 1, name: "Laptop" }]);
      render(
        <MemoryRouter>
          <CreateTicket />
        </MemoryRouter>
      );
      await screen.findByText("Create Support Ticket");
      await waitFor(() => expect(screen.getByLabelText(/Category/)).toBeEnabled());
      fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText(/Related System/), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText(/Ticket Summary/), { target: { value: "Laptop will not boot" } });
      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "It shows a black screen after the logo." } });
    };
    const submit = () => fireEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    it("resends the same key when the user resubmits unchanged content after a lost response", async () => {
      (api.createTicket as any).mockRejectedValueOnce(new Error(api.NETWORK_ERROR_MESSAGE)).mockResolvedValueOnce({ data: { ticketNumber: "TKT-1" } });
      await fillForm();

      submit();
      expect(await screen.findByText(api.NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
      submit();
      await screen.findByText("TKT-1");

      expect(api.createTicket).toHaveBeenCalledTimes(2);
      expect(keyOf(api.createTicket, 1, 1)).toBe(keyOf(api.createTicket, 0, 1));
    });

    it("uses a new key once the content was edited after a failure", async () => {
      (api.createTicket as any).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ data: { ticketNumber: "TKT-2" } });
      await fillForm();

      submit();
      await screen.findByText("boom");
      fireEvent.change(screen.getByLabelText(/Ticket Summary/), { target: { value: "Laptop will not boot at all" } });
      submit();
      await screen.findByText("TKT-2");

      expect(keyOf(api.createTicket, 1, 1)).not.toBe(keyOf(api.createTicket, 0, 1));
    });
  });

  describe("staff comment and note", () => {
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
    const renderStaff = async () => {
      currentUser = { id: "staff-1", fullName: "IT Staff", email: "staff@example.com", role: "IT_STAFF" };
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
    const commentBox = () => screen.getByPlaceholderText("Write a message to the requester...") as HTMLTextAreaElement;

    it("retries a public comment with the same key, then uses a fresh key for the next comment", async () => {
      (api.addPublicComment as any).mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({});
      await renderStaff();

      fireEvent.change(commentBox(), { target: { value: "Please try again" } });
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
      await screen.findByText("timeout");
      expect(commentBox()).toHaveValue("Please try again"); // the text survives the failure
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
      await screen.findByText("Public comment added successfully");

      expect(keyOf(api.addPublicComment, 1, 2)).toBe(keyOf(api.addPublicComment, 0, 2));

      fireEvent.change(commentBox(), { target: { value: "Please try again" } }); // the same words, but a new comment
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
      await waitFor(() => expect(api.addPublicComment).toHaveBeenCalledTimes(3));
      expect(keyOf(api.addPublicComment, 2, 2)).not.toBe(keyOf(api.addPublicComment, 1, 2));
    });

    it("keeps comment and note keys independent", async () => {
      (api.addPublicComment as any).mockResolvedValue({});
      (api.addInternalNote as any).mockResolvedValue({});
      await renderStaff();

      fireEvent.change(commentBox(), { target: { value: "same text" } });
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
      await screen.findByText("Public comment added successfully");
      const noteBox = screen.getByPlaceholderText("Write an internal operational note...");
      fireEvent.change(noteBox, { target: { value: "same text" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Internal Note" }));
      await screen.findByText("Internal note added successfully");

      expect(keyOf(api.addInternalNote, 0, 2)).not.toBe(keyOf(api.addPublicComment, 0, 2));
    });
  });

  describe("requester comment", () => {
    const ticket = {
      id: 101,
      ticketNumber: "TKT-101",
      summary: "My laptop",
      description: "Does not start",
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 2, name: "Laptop" },
      requester: { id: "u-1", name: "Test User", email: "test@example.com" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      createdAt: "2026-09-02T10:15:30.000Z",
      updatedAt: "2026-09-02T10:15:30.000Z",
      attachments: []
    };
    const renderRequester = async () => {
      (api.getTicket as any).mockResolvedValue({ data: ticket });
      (api.getPublicComments as any).mockResolvedValue({ data: [] });
      (api.getActionsTaken as any).mockResolvedValue({ data: [] });
      render(
        <MemoryRouter initialEntries={["/tickets/101"]}>
          <Routes>
            <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
          </Routes>
        </MemoryRouter>
      );
      await screen.findByText("TKT-101");
    };

    it("keeps the page, the form and the typed text after a failed comment, and the retry reuses the key", async () => {
      (api.addPublicComment as any).mockRejectedValueOnce(new Error(api.NETWORK_ERROR_MESSAGE)).mockResolvedValueOnce({});
      await renderRequester();

      fireEvent.click(screen.getByRole("button", { name: /Public Comments/ }));
      const box = await screen.findByPlaceholderText("Type your message to IT staff...");
      fireEvent.change(box, { target: { value: "Still broken" } });
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(api.NETWORK_ERROR_MESSAGE);
      expect(screen.getByText("TKT-101")).toBeInTheDocument(); // the ticket page is still there
      expect(screen.getByPlaceholderText("Type your message to IT staff...")).toHaveValue("Still broken");

      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));
      await screen.findByText("Comment added successfully.");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // the old error is cleared
      expect(keyOf(api.addPublicComment, 1, 2)).toBe(keyOf(api.addPublicComment, 0, 2));
    });

    it("sends a key, and tells the user the comment was saved when only the list refresh fails", async () => {
      (api.addPublicComment as any).mockResolvedValue({});
      await renderRequester();

      fireEvent.click(screen.getByRole("button", { name: /Public Comments/ }));
      fireEvent.change(await screen.findByPlaceholderText("Type your message to IT staff..."), { target: { value: "Any update?" } });
      (api.getPublicComments as any).mockRejectedValue(new Error("refresh failed"));
      fireEvent.click(screen.getByRole("button", { name: "Post Comment" }));

      expect(await screen.findByText(/Your comment was saved, but the list could not be refreshed/)).toBeInTheDocument();
      expect(screen.queryByText(/Failed to add comment/)).not.toBeInTheDocument();
      expect(keyOf(api.addPublicComment, 0, 2)).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    });
  });
});
