import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ActionsTakenSection from "../../src/components/ActionsTakenSection";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail";
import { RequesterTicketDetail } from "../../src/pages/RequesterTicketDetail";
import * as api from "../../src/api";

vi.mock("../../src/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/api")>("../../src/api");
  return {
    ...actual,
    getActionsTaken: vi.fn(),
    createActionTaken: vi.fn(),
    updateActionTaken: vi.fn(),
    getStaffTicketDetail: vi.fn(),
    getStaffAssignees: vi.fn(),
    getTicket: vi.fn(),
    getPublicComments: vi.fn()
  };
});

const staffUser = { id: "staff-1", fullName: "Staff Technician One", email: "one@example.com", role: "IT_STAFF" };
let currentUser: any = staffUser;

vi.mock("../../src/contexts/AuthContext", async () => {
  const actual = await vi.importActual("../../src/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({ user: currentUser, login: vi.fn(), logout: vi.fn() })
  };
});

const assignees = [
  { id: "staff-1", fullName: "Staff Technician One", role: "IT_STAFF" },
  { id: "staff-2", fullName: "Staff Technician Two", role: "IT_STAFF" },
  { id: "admin-1", fullName: "Admin One", role: "ADMIN" }
];

const makeAction = (overrides: Record<string, unknown> = {}): api.ActionTaken => ({
  id: 1,
  ticketId: 7,
  performedBy: { id: "staff-1", fullName: "Staff Technician One", role: "IT_STAFF" },
  assignedToId: "staff-2",
  assignedTo: { id: "staff-2", fullName: "Staff Technician Two", role: "IT_STAFF" },
  actionDateTime: "2026-10-30T10:15:00.000Z",
  description: "Replaced damaged CAT6 cable and verified link.",
  result: "Link stable; ping latency under 1ms.",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: "Referenced test report: port14.log",
  createdAt: "2026-10-30T10:15:00.000Z",
  updatedAt: "2026-10-30T10:15:30.000Z",
  revisions: [],
  ...overrides
});

const renderStaff = (props: Record<string, unknown> = {}) =>
  render(<ActionsTakenSection ticketId={7} ticketStatus="OPEN" isStaff assignees={assignees} {...props} />);

const renderRequester = (props: Record<string, unknown> = {}) =>
  render(<ActionsTakenSection ticketId={7} ticketStatus="OPEN" isStaff={false} {...props} />);

const setField = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const openAddModal = async () => {
  await screen.findByRole("button", { name: /Add Action Taken/i });
  fireEvent.click(screen.getByRole("button", { name: /Add Action Taken/i }));
  return screen.getByRole("dialog");
};

const fillValidCreateForm = () => {
  setField(/^Description/, "Replaced the failing switch port");
  setField(/^Result/, "Link restored");
};

describe("ActionsTakenSection — IT Staff / Admin view (ui-spec §3.2)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = staffUser;
  });

  it("shows a loading state, then the list with the record count in the header", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction(), makeAction({ id: 2, description: "Second action description" })] });
    renderStaff();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Service Actions (2)" })).toBeInTheDocument();
    expect(api.getActionsTaken).toHaveBeenCalledWith(7);
  });

  it("renders every card field: performer, assignee, description, result, follow-up indicator, attachment notes", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
    renderStaff();

    expect(await screen.findByText("Replaced damaged CAT6 cable and verified link.")).toBeInTheDocument();
    expect(screen.getByText("Link stable; ping latency under 1ms.")).toBeInTheDocument();
    expect(screen.getByText(/Performed by:/)).toHaveTextContent("Staff Technician One");
    expect(screen.getByText(/Assigned to:/)).toHaveTextContent("Staff Technician Two");
    expect(screen.getByText("No follow-up required")).toBeInTheDocument();
    expect(screen.getByText(/port14\.log/)).toBeInTheDocument();
    expect(screen.queryByText(/Follow-Up Note/)).not.toBeInTheDocument();
  });

  it("shows the follow-up pill and note only when follow-up is required", async () => {
    (api.getActionsTaken as any).mockResolvedValue({
      data: [makeAction({ followUpRequired: true, followUpNote: "Monitor the port for 24 hours", assignedTo: null, assignedToId: null })]
    });
    renderStaff();

    expect(await screen.findByText("Follow-up required")).toBeInTheDocument();
    expect(screen.getByText("Monitor the port for 24 hours")).toBeInTheDocument();
    expect(screen.getByText(/Assigned to:/)).toHaveTextContent("Unassigned");
  });

  it("shows the staff empty state with a call-to-action that opens the Add modal", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [] });
    renderStaff();

    expect(await screen.findByText("No service actions recorded for this ticket.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add the first Action Taken/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error alert with a retry that reloads the list", async () => {
    (api.getActionsTaken as any)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ data: [makeAction()] });
    renderStaff();

    expect(await screen.findByText("Unable to load service actions. Please try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(await screen.findByText("Replaced damaged CAT6 cable and verified link.")).toBeInTheDocument();
    expect(api.getActionsTaken).toHaveBeenCalledTimes(2);
  });

  it("never renders a Delete control (deletion is prohibited, BR-05)", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
    renderStaff();
    await screen.findByText("Replaced damaged CAT6 cable and verified link.");
    expect(screen.queryByRole("button", { name: /delete|remove/i })).not.toBeInTheDocument();
  });

  it("reports the loaded record count through onCountChange", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction(), makeAction({ id: 2 })] });
    const onCountChange = vi.fn();
    renderStaff({ onCountChange });
    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(2));
  });

  describe("terminal tickets (UI-Q3 / BR-08)", () => {
    it.each(["CLOSED", "CANCELLED", "REJECTED"])("disables Add and Edit on a %s ticket", async (status) => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
      renderStaff({ ticketStatus: status });

      await screen.findByText("Replaced damaged CAT6 cable and verified link.");
      expect(screen.getByRole("button", { name: /Add Action Taken/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Edit/i })).toBeDisabled();
    });

    it("keeps Add and Edit enabled on a RESOLVED ticket", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
      renderStaff({ ticketStatus: "RESOLVED" });

      await screen.findByText("Replaced damaged CAT6 cable and verified link.");
      expect(screen.getByRole("button", { name: /Add Action Taken/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /^Edit/i })).toBeEnabled();
    });

    it("does not offer the empty-state call-to-action on a terminal ticket", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [] });
      renderStaff({ ticketStatus: "CLOSED" });
      await screen.findByText("No service actions recorded for this ticket.");
      expect(screen.queryByRole("button", { name: /Add the first Action Taken/i })).not.toBeInTheDocument();
    });
  });

  describe("Add Action Taken modal (ui-spec §3.2.4)", () => {
    beforeEach(() => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [] });
    });

    it("is an accessible dialog titled 'Record Action Taken' that is full-screen on mobile", async () => {
      renderStaff();
      const dialog = await openAddModal();

      expect(dialog).toHaveAttribute("aria-modal", "true");
      const titleId = dialog.getAttribute("aria-labelledby")!;
      expect(document.getElementById(titleId)).toHaveTextContent("Record Action Taken");
      expect(dialog.querySelector(".modal-dialog")).toHaveClass("modal-fullscreen-sm-down");
    });

    it("shows the authenticated user as a read-only 'Performed By' (not an input)", async () => {
      renderStaff();
      const dialog = await openAddModal();

      const performed = within(dialog).getByTestId("performed-by");
      expect(performed).toHaveTextContent("Staff Technician One");
      expect(performed).toHaveTextContent("IT_STAFF");
      expect(within(dialog).queryByLabelText(/Performed By/i)).not.toBeInTheDocument();
    });

    it("lists only the provided active assignees and defaults to unassigned", async () => {
      renderStaff();
      const dialog = await openAddModal();

      const select = within(dialog).getByLabelText(/Assigned To/i) as HTMLSelectElement;
      expect(select.value).toBe("");
      expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Unassigned",
        "Staff Technician One (IT_STAFF)",
        "Staff Technician Two (IT_STAFF)",
        "Admin One (ADMIN)"
      ]);
    });

    it("blocks submission and shows accessible inline errors when required fields are empty", async () => {
      renderStaff();
      await openAddModal();

      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      const description = screen.getByLabelText(/^Description/);
      const result = screen.getByLabelText(/^Result/);
      expect(description).toHaveAttribute("aria-invalid", "true");
      expect(result).toHaveAttribute("aria-invalid", "true");
      expect(description).toHaveAttribute("aria-required", "true");
      expect(document.getElementById(description.getAttribute("aria-describedby")!)).toHaveTextContent(/description is required/i);
      expect(document.getElementById(result.getAttribute("aria-describedby")!)).toHaveTextContent(/result is required/i);
      expect(api.createActionTaken).not.toHaveBeenCalled();
    });

    it.each([
      ["description shorter than 5 characters", /^Description/, "abcd", /between 5 and 3,000/i],
      ["description longer than 3,000 characters", /^Description/, "a".repeat(3001), /between 5 and 3,000/i],
      ["result shorter than 2 characters", /^Result/, "a", /between 2 and 1,000/i],
      ["result longer than 1,000 characters", /^Result/, "a".repeat(1001), /between 2 and 1,000/i],
      ["attachment notes longer than 1,000 characters", /^Attachment Notes/, "a".repeat(1001), /at most 1,000/i]
    ])("rejects %s", async (_label, field, value, message) => {
      renderStaff();
      await openAddModal();
      fillValidCreateForm();
      setField(field, value);

      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(api.createActionTaken).not.toHaveBeenCalled();
    });

    it("rejects an Action Date/Time more than 5 minutes in the future", async () => {
      renderStaff();
      await openAddModal();
      fillValidCreateForm();
      setField(/^Action Date\/Time/, "2099-01-01T10:00");

      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText(/more than 5 minutes in the future/i)).toBeInTheDocument();
      expect(api.createActionTaken).not.toHaveBeenCalled();
    });

    it("disables Follow-Up Note until Follow-Up Required is checked, then requires it and focuses it", async () => {
      renderStaff();
      await openAddModal();

      const note = screen.getByLabelText(/^Follow-Up Note/) as HTMLTextAreaElement;
      expect(note).toBeDisabled();

      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));
      expect(note).toBeEnabled();
      expect(note).toHaveAttribute("aria-required", "true");
      await waitFor(() => expect(note).toHaveFocus());

      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));
      expect(await screen.findByText(/follow-up note is required/i)).toBeInTheDocument();
      expect(api.createActionTaken).not.toHaveBeenCalled();
    });

    it("clears the Follow-Up Note when Follow-Up Required is unchecked", async () => {
      renderStaff();
      await openAddModal();

      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));
      setField(/^Follow-Up Note/, "Check again tomorrow");
      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));

      const note = screen.getByLabelText(/^Follow-Up Note/) as HTMLTextAreaElement;
      expect(note).toBeDisabled();
      expect(note.value).toBe("");
    });

    it("creates the action, closes the modal, shows the success message and refreshes the list", async () => {
      (api.getActionsTaken as any)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [makeAction({ description: "Replaced the failing switch port" })] });
      (api.createActionTaken as any).mockResolvedValue({ message: "Action taken recorded successfully", data: makeAction() });
      const onCountChange = vi.fn();
      renderStaff({ onCountChange });
      await openAddModal();

      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText("Action Taken recorded successfully.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Service Actions (1)" })).toBeInTheDocument();
      expect(screen.getByText("Replaced the failing switch port")).toBeInTheDocument();
      expect(onCountChange).toHaveBeenLastCalledWith(1);
    });

    it("sends only the user-entered fields (no performer) and an Idempotency-Key", async () => {
      (api.createActionTaken as any).mockResolvedValue({ message: "ok", data: makeAction() });
      renderStaff();
      await openAddModal();

      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(1));
      const [ticketId, payload, key] = (api.createActionTaken as any).mock.calls[0];
      expect(ticketId).toBe(7);
      expect(payload).toEqual({
        description: "Replaced the failing switch port",
        result: "Link restored",
        followUpRequired: false
      });
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(8);
    });

    it("includes assignee, follow-up note, attachment notes and a valid ISO date when provided", async () => {
      (api.createActionTaken as any).mockResolvedValue({ message: "ok", data: makeAction() });
      renderStaff();
      await openAddModal();

      fillValidCreateForm();
      setField(/Assigned To/i, "staff-2");
      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));
      setField(/^Follow-Up Note/, "  Recheck on Monday  ");
      setField(/^Attachment Notes/, "See switch-log.txt");
      setField(/^Action Date\/Time/, "2026-01-02T03:04");
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(1));
      const payload = (api.createActionTaken as any).mock.calls[0][1];
      expect(payload).toMatchObject({
        assignedToId: "staff-2",
        followUpRequired: true,
        followUpNote: "Recheck on Monday",
        attachmentNotes: "See switch-log.txt"
      });
      expect(new Date(payload.actionDateTime).toISOString()).toBe(new Date("2026-01-02T03:04").toISOString());
    });

    it("disables the submit button with a spinner while in flight and prevents a duplicate submission", async () => {
      let resolveCreate: (v: unknown) => void = () => {};
      (api.createActionTaken as any).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
      renderStaff();
      await openAddModal();
      fillValidCreateForm();

      const submit = screen.getByRole("button", { name: "Record Action" });
      fireEvent.click(submit);
      fireEvent.click(submit);

      await waitFor(() => expect(submit).toBeDisabled());
      expect(within(submit).getByRole("status")).toBeInTheDocument();
      expect(api.createActionTaken).toHaveBeenCalledTimes(1);

      await act(async () => resolveCreate({ message: "ok", data: makeAction() }));
    });

    it("keeps the modal open and preserves every entered value after a server/network failure", async () => {
      (api.createActionTaken as any).mockRejectedValue(new api.ApiError("Internal server error", 500));
      renderStaff();
      await openAddModal();

      fillValidCreateForm();
      setField(/Assigned To/i, "staff-2");
      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));
      setField(/^Follow-Up Note/, "Recheck on Monday");
      setField(/^Attachment Notes/, "See switch-log.txt");
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText("Failed to record action due to network error. Form data has been preserved. Please retry.")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/)).toHaveValue("Replaced the failing switch port");
      expect(screen.getByLabelText(/^Result/)).toHaveValue("Link restored");
      expect(screen.getByLabelText(/Assigned To/i)).toHaveValue("staff-2");
      expect(screen.getByLabelText(/Follow-Up Required/i)).toBeChecked();
      expect(screen.getByLabelText(/^Follow-Up Note/)).toHaveValue("Recheck on Monday");
      expect(screen.getByLabelText(/^Attachment Notes/)).toHaveValue("See switch-log.txt");
      expect(screen.getByRole("button", { name: "Record Action" })).toBeEnabled();
    });

    it("treats a dropped connection (fetch TypeError) like a network failure and keeps the draft", async () => {
      (api.createActionTaken as any).mockRejectedValue(new TypeError("Failed to fetch"));
      renderStaff();
      await openAddModal();
      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText(/Failed to record action due to network error/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/)).toHaveValue("Replaced the failing switch port");
    });

    it("reuses the same Idempotency-Key for a retry of the unchanged payload, and a new key once the payload changes", async () => {
      (api.createActionTaken as any).mockRejectedValue(new api.ApiError("Internal server error", 500));
      renderStaff();
      await openAddModal();
      fillValidCreateForm();

      const submit = () => fireEvent.click(screen.getByRole("button", { name: "Record Action" }));
      submit();
      await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(1));
      await screen.findByText(/Failed to record action/);
      submit();
      await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole("button", { name: "Record Action" })).toBeEnabled());

      const calls = (api.createActionTaken as any).mock.calls;
      expect(calls[1][2]).toBe(calls[0][2]);

      setField(/^Result/, "Link restored after replacement");
      submit();
      await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(3));
      expect(calls[2][2]).not.toBe(calls[0][2]);
    });

    it.each(["INACTIVE_ASSIGNEE", "INVALID_ASSIGNEE_ROLE"])("shows the assignee guidance for %s and keeps the draft", async (code) => {
      (api.createActionTaken as any).mockRejectedValue(new api.ApiError("rejected", 400, code));
      renderStaff();
      await openAddModal();
      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText("Selected assignee is inactive or unauthorized. Please select an active IT Staff member.")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/)).toHaveValue("Replaced the failing switch port");
    });

    it("shows the server validation message when the API rejects the input", async () => {
      (api.createActionTaken as any).mockRejectedValue(new api.ApiError("description must be between 5 and 3000 characters", 400, "VALIDATION_ERROR"));
      renderStaff();
      await openAddModal();
      fillValidCreateForm();
      fireEvent.click(screen.getByRole("button", { name: "Record Action" }));

      expect(await screen.findByText("description must be between 5 and 3000 characters")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes with Escape and discards the draft", async () => {
      renderStaff();
      const dialog = await openAddModal();
      fillValidCreateForm();

      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.createActionTaken).not.toHaveBeenCalled();

      await openAddModal();
      expect(screen.getByLabelText(/^Description/)).toHaveValue("");
    });

    it("traps keyboard focus inside the dialog (Tab wraps forward, Shift+Tab wraps backward)", async () => {
      renderStaff();
      const dialog = await openAddModal();

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])")
      ).filter((el) => !(el as HTMLButtonElement).disabled);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      fireEvent.keyDown(dialog, { key: "Tab" });
      expect(first).toHaveFocus();

      first.focus();
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
    });

    it("moves focus into the dialog when it opens", async () => {
      renderStaff();
      const dialog = await openAddModal();
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    });
  });

  describe("Edit Action Taken modal (ui-spec §3.2.5)", () => {
    beforeEach(() => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
    });

    const openEditModal = async () => {
      await screen.findByText("Replaced damaged CAT6 cable and verified link.");
      fireEvent.click(screen.getByRole("button", { name: /^Edit/i }));
      return screen.getByRole("dialog");
    };

    it("opens pre-populated, shows the original author read-only, and warns that edits are append-only", async () => {
      renderStaff({ ticketStatus: "OPEN" });
      currentUser = { ...staffUser, id: "staff-2", fullName: "Staff Technician Two" };
      const dialog = await openEditModal();

      expect(within(dialog).getByText("Edit Action Taken")).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/^Description/)).toHaveValue("Replaced damaged CAT6 cable and verified link.");
      expect(within(dialog).getByLabelText(/^Result/)).toHaveValue("Link stable; ping latency under 1ms.");
      expect(within(dialog).getByLabelText(/Assigned To/i)).toHaveValue("staff-2");
      expect(within(dialog).getByLabelText(/^Attachment Notes/)).toHaveValue("Referenced test report: port14.log");
      expect(within(dialog).getByTestId("performed-by")).toHaveTextContent("Staff Technician One");
      expect(within(dialog).getByText(/append-only revision history/i)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    });

    it("submits the edit with expectedUpdatedAt copied from the loaded record and never sends the performer", async () => {
      (api.updateActionTaken as any).mockResolvedValue({ message: "ok", data: makeAction() });
      renderStaff();
      await openEditModal();

      setField(/^Result/, "Gigabit link negotiated");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => expect(api.updateActionTaken).toHaveBeenCalledTimes(1));
      const [actionId, payload] = (api.updateActionTaken as any).mock.calls[0];
      expect(actionId).toBe(1);
      expect(payload.expectedUpdatedAt).toBe("2026-10-30T10:15:30.000Z");
      expect(payload.result).toBe("Gigabit link negotiated");
      expect(payload).not.toHaveProperty("performedById");
      expect(payload).not.toHaveProperty("performedBy");
    });

    it("closes, refreshes and shows the success message after saving", async () => {
      (api.getActionsTaken as any)
        .mockResolvedValueOnce({ data: [makeAction()] })
        .mockResolvedValueOnce({ data: [makeAction({ result: "Gigabit link negotiated" })] });
      (api.updateActionTaken as any).mockResolvedValue({ message: "ok", data: makeAction() });
      renderStaff();
      await openEditModal();

      setField(/^Result/, "Gigabit link negotiated");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText("Action Taken updated successfully.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await screen.findByText("Gigabit link negotiated")).toBeInTheDocument();
    });

    it("shows the stale-update message on 409 STALE_UPDATE and preserves the draft", async () => {
      (api.updateActionTaken as any).mockRejectedValue(new api.ApiError("stale", 409, "STALE_UPDATE"));
      renderStaff();
      await openEditModal();

      setField(/^Result/, "My unsaved edit");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText("This action was updated by another user. Please reload the page to see the latest version before editing.")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Result/)).toHaveValue("My unsaved edit");
    });

    it("keeps the draft and shows the network message on a 500", async () => {
      (api.updateActionTaken as any).mockRejectedValue(new api.ApiError("Internal server error", 500));
      renderStaff();
      await openEditModal();

      setField(/^Result/, "My unsaved edit");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText(/Form data has been preserved/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Result/)).toHaveValue("My unsaved edit");
    });

    it("shows the server validation message on a 400 and keeps the draft", async () => {
      (api.updateActionTaken as any).mockRejectedValue(new api.ApiError("result must be between 2 and 1000 characters", 400, "VALIDATION_ERROR"));
      renderStaff();
      await openEditModal();

      setField(/^Result/, "My unsaved edit");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText("result must be between 2 and 1000 characters")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Result/)).toHaveValue("My unsaved edit");
    });

    it("requires an Action Date/Time on edit instead of crashing when it is cleared", async () => {
      renderStaff();
      await openEditModal();

      setField(/^Action Date\/Time/, "");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText("Action Date/Time is required.")).toBeInTheDocument();
      expect(api.updateActionTaken).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("applies the same validation as create (e.g. cannot clear the description)", async () => {
      renderStaff();
      await openEditModal();

      setField(/^Description/, "");
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText(/description is required/i)).toBeInTheDocument();
      expect(api.updateActionTaken).not.toHaveBeenCalled();
    });

    it("makes Follow-Up Note required when an edit turns follow-up on", async () => {
      renderStaff();
      await openEditModal();

      fireEvent.click(screen.getByLabelText(/Follow-Up Required/i));
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText(/follow-up note is required/i)).toBeInTheDocument();
      expect(api.updateActionTaken).not.toHaveBeenCalled();
    });
  });

  describe("Revision History (ui-spec §3.2.3)", () => {
    const revisions: api.ActionTakenRevision[] = [
      {
        id: 1,
        revisionNumber: 1,
        editedAt: "2026-10-30T10:20:00.000Z",
        editor: { id: "staff-1", fullName: "Staff Technician One", role: "IT_STAFF" },
        originalData: { result: "Link negotiated", description: "Same" },
        updatedData: { result: "Gigabit link negotiated", description: "Same" }
      },
      {
        id: 2,
        revisionNumber: 2,
        editedAt: "2026-10-30T10:30:00.000Z",
        editor: { id: "staff-2", fullName: "Staff Technician Two", role: "IT_STAFF" },
        originalData: { followUpRequired: false },
        updatedData: { followUpRequired: true }
      }
    ];

    it("is collapsed by default, expands newest-first with editor and changed values, and can be collapsed", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction({ revisions })] });
      renderStaff();

      const toggle = await screen.findByRole("button", { name: /View Revision History \(2\)/ });
      expect(screen.queryByText(/Revision 1/)).not.toBeInTheDocument();
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      const rev2 = screen.getByText(/Revision 2/);
      const rev1 = screen.getByText(/Revision 1/);
      expect(rev2.compareDocumentPosition(rev1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(rev1.closest("li")).toHaveTextContent("Staff Technician One");
      expect(rev1.closest("li")).toHaveTextContent("Link negotiated");
      expect(rev1.closest("li")).toHaveTextContent("Gigabit link negotiated");
      expect(rev1.closest("li")).not.toHaveTextContent(/Same/);
      expect(rev2.closest("li")).toHaveTextContent("Staff Technician Two");

      fireEvent.click(screen.getByRole("button", { name: /Hide Revision History \(2\)/ }));
      expect(screen.queryByText(/Revision 1/)).not.toBeInTheDocument();
    });

    it("does not render a revision toggle when a record has no revisions", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction({ revisions: [] })] });
      renderStaff();
      await screen.findByText("Replaced damaged CAT6 cable and verified link.");
      expect(screen.queryByRole("button", { name: /Revision History/ })).not.toBeInTheDocument();
    });
  });
});

describe("ActionsTakenSection — Requester read-only view (ui-spec §3.1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser = { id: "req-1", fullName: "Requester", email: "r@example.com", role: "REQUESTER" };
  });

  it("renders the record fields with no create, edit or revision controls", async () => {
    (api.getActionsTaken as any).mockResolvedValue({
      data: [makeAction({ followUpRequired: true, followUpNote: "Monitor the port", revisions: [{ id: 1, revisionNumber: 1, editedAt: "2026-10-30T10:20:00.000Z" }] })]
    });
    renderRequester();

    expect(await screen.findByText("Replaced damaged CAT6 cable and verified link.")).toBeInTheDocument();
    expect(screen.getByText("Link stable; ping latency under 1ms.")).toBeInTheDocument();
    expect(screen.getByText(/Performed by:/)).toHaveTextContent("Staff Technician One");
    expect(screen.getByText(/Assigned to:/)).toHaveTextContent("Staff Technician Two");
    expect(screen.getByText("Follow-up required")).toBeInTheDocument();
    expect(screen.getByText("Monitor the port")).toBeInTheDocument();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Revision/i)).not.toBeInTheDocument();
  });

  it("shows the requester empty state without a call-to-action", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [] });
    renderRequester();

    expect(await screen.findByText("No service actions recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("IT Staff will log actions as work progresses.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a loading spinner and then an error with a retry link", async () => {
    (api.getActionsTaken as any)
      .mockRejectedValueOnce(new api.ApiError("Ticket not found", 404, "NOT_FOUND"))
      .mockResolvedValueOnce({ data: [makeAction()] });
    renderRequester();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("Unable to load service actions. Please try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(await screen.findByText("Replaced damaged CAT6 cable and verified link.")).toBeInTheDocument();
  });

  it("does not show the attachment-notes line for an empty value", async () => {
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction({ attachmentNotes: null })] });
    renderRequester();
    await screen.findByText("Replaced damaged CAT6 cable and verified link.");
    expect(screen.queryByText(/Attachment Notes/i)).not.toBeInTheDocument();
  });
});

describe("Ticket detail pages integration", () => {
  const staffTicket = (status = "OPEN") => ({
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
    owner: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attachments: [],
    publicComments: [],
    internalNotes: []
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderStaffPage = () =>
    render(
      <MemoryRouter initialEntries={["/staff/tickets/1"]}>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </MemoryRouter>
    );

  it("StaffTicketDetail mounts the Actions Taken section with the loaded ticket and assignees", async () => {
    currentUser = staffUser;
    (api.getStaffTicketDetail as any).mockResolvedValue(staffTicket("IN_PROGRESS"));
    (api.getStaffAssignees as any).mockResolvedValue({ data: assignees });
    (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction()] });
    renderStaffPage();

    expect(await screen.findByRole("heading", { name: "Service Actions (1)" })).toBeInTheDocument();
    expect(api.getActionsTaken).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Add Action Taken/i }));
    expect(within(screen.getByRole("dialog")).getByLabelText(/Assigned To/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText(/Assigned To/i)).getAllByRole("option")).toHaveLength(4);
  });

  it("StaffTicketDetail disables Add Action Taken on a terminal ticket", async () => {
    currentUser = staffUser;
    (api.getStaffTicketDetail as any).mockResolvedValue(staffTicket("CLOSED"));
    (api.getStaffAssignees as any).mockResolvedValue({ data: assignees });
    (api.getActionsTaken as any).mockResolvedValue({ data: [] });
    renderStaffPage();

    await screen.findByText("No service actions recorded for this ticket.");
    expect(screen.getByRole("button", { name: /Add Action Taken/i })).toBeDisabled();
  });

  describe("RequesterTicketDetail", () => {
    const requesterTicket = {
      id: 101,
      ticketNumber: "TKT-2026-000101",
      summary: "Test ticket summary",
      description: "This is the description.",
      category: { id: 1, name: "Hardware" },
      relatedSystem: { id: 2, name: "Laptop" },
      requester: { id: "req-1", fullName: "John Doe", email: "john@example.com" },
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      status: "OPEN",
      createdAt: "2026-09-02T10:15:30.000Z",
      updatedAt: "2026-09-02T10:15:30.000Z",
      attachments: []
    };

    const renderRequesterPage = () =>
      render(
        <MemoryRouter initialEntries={["/tickets/101"]}>
          <Routes>
            <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
          </Routes>
        </MemoryRouter>
      );

    beforeEach(() => {
      currentUser = { id: "req-1", fullName: "John Doe", email: "john@example.com", role: "REQUESTER" };
      (api.getTicket as any).mockResolvedValue({ data: requesterTicket });
      (api.getPublicComments as any).mockResolvedValue({ data: [] });
    });

    it("activates the Service Actions tab with a count and shows the read-only list when opened", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [makeAction(), makeAction({ id: 2, description: "Second action" })] });
      renderRequesterPage();

      const tab = await screen.findByRole("button", { name: "Service Actions (2)" });
      expect(tab).toBeEnabled();
      expect(screen.queryByText("Second action")).not.toBeInTheDocument();

      fireEvent.click(tab);
      expect(await screen.findByText("Second action")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Add Action Taken|^Edit/i })).not.toBeInTheDocument();
    });

    it("keeps the default tab, and keeps Event Log disabled", async () => {
      (api.getActionsTaken as any).mockResolvedValue({ data: [] });
      renderRequesterPage();

      await screen.findByRole("button", { name: "Service Actions (0)" });
      expect(screen.getByRole("button", { name: /Event Log/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Attachments/ })).toHaveClass("active");
    });

    it("still renders the ticket when the actions request fails", async () => {
      (api.getActionsTaken as any).mockRejectedValue(new api.ApiError("nope", 500));
      renderRequesterPage();

      expect(await screen.findByText("Test ticket summary")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Service Actions (0)" })).toBeEnabled();
    });
  });
});
