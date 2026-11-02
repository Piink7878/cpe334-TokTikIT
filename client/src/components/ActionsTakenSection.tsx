import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ActionTaken,
  ActionTakenRevision,
  ApiError,
  CreateActionTakenInput,
  UpdateActionTakenInput,
  createActionTaken,
  getActionsTaken,
  updateActionTaken
} from "../api";

// Actions Taken panel (ui-spec.md §3). Staff/Admin: list + create + edit + revision history.
// Requester: read-only list (no controls, no revision data).

export interface AssigneeOption {
  id: string;
  fullName: string;
  role: string;
}

interface ActionsTakenSectionProps {
  ticketId: number;
  ticketStatus: string;
  isStaff: boolean;
  assignees?: AssigneeOption[];
  onCountChange?: (count: number) => void;
}

interface FormValues {
  actionDateTime: string;
  assignedToId: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const TERMINAL_STATUSES = ["CLOSED", "CANCELLED", "REJECTED"];
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const NETWORK_MESSAGE_CREATE = "Failed to record action due to network error. Form data has been preserved. Please retry.";
const NETWORK_MESSAGE_EDIT = "Failed to update action due to network error. Form data has been preserved. Please retry.";
const ASSIGNEE_MESSAGE = "Selected assignee is inactive or unauthorized. Please select an active IT Staff member.";
const STALE_MESSAGE = "This action was updated by another user. Please reload the page to see the latest version before editing.";

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  result: "Result",
  followUpRequired: "Follow-Up Required",
  followUpNote: "Follow-Up Note",
  attachmentNotes: "Attachment Notes",
  assignedToId: "Assigned To",
  actionDateTime: "Action Date/Time"
};

const formatDateTime = (iso: string) => new Date(iso).toLocaleString();

const pad = (n: number) => String(n).padStart(2, "0");

// datetime-local expects "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const newIdempotencyKey = () => {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const emptyValues = (): FormValues => ({
  actionDateTime: "",
  assignedToId: "",
  description: "",
  result: "",
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: ""
});

const valuesFromAction = (a: ActionTaken): FormValues => ({
  actionDateTime: toLocalInput(a.actionDateTime),
  assignedToId: a.assignedToId || "",
  description: a.description,
  result: a.result,
  followUpRequired: a.followUpRequired,
  followUpNote: a.followUpNote || "",
  attachmentNotes: a.attachmentNotes || ""
});

// Mirrors the server limits in specification.md BR-04.
function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const description = values.description.trim();
  const result = values.result.trim();

  if (!description) errors.description = "Description is required.";
  else if (description.length < 5 || description.length > 3000) errors.description = "Description must be between 5 and 3,000 characters.";

  if (!result) errors.result = "Result is required.";
  else if (result.length < 2 || result.length > 1000) errors.result = "Result must be between 2 and 1,000 characters.";

  const note = values.followUpNote.trim();
  if (values.followUpRequired && !note) errors.followUpNote = "Follow-Up Note is required when follow-up is required.";
  else if (note.length > 1000) errors.followUpNote = "Follow-Up Note must be at most 1,000 characters.";

  if (values.attachmentNotes.trim().length > 1000) errors.attachmentNotes = "Attachment Notes must be at most 1,000 characters.";

  if (values.actionDateTime) {
    const t = new Date(values.actionDateTime).getTime();
    if (isNaN(t)) errors.actionDateTime = "Enter a valid date and time.";
    else if (t > Date.now() + FUTURE_TOLERANCE_MS) errors.actionDateTime = "Action Date/Time cannot be more than 5 minutes in the future.";
  }

  return errors;
}

function buildCreatePayload(v: FormValues): CreateActionTakenInput {
  const payload: CreateActionTakenInput = {
    description: v.description.trim(),
    result: v.result.trim(),
    followUpRequired: v.followUpRequired
  };
  if (v.followUpRequired) payload.followUpNote = v.followUpNote.trim();
  if (v.attachmentNotes.trim()) payload.attachmentNotes = v.attachmentNotes.trim();
  if (v.assignedToId) payload.assignedToId = v.assignedToId;
  if (v.actionDateTime) payload.actionDateTime = new Date(v.actionDateTime).toISOString();
  return payload;
}

// Sends only the fields the user changed; returns null when nothing changed.
function buildUpdatePayload(v: FormValues, initial: FormValues, expectedUpdatedAt: string): UpdateActionTakenInput | null {
  const payload: UpdateActionTakenInput = { expectedUpdatedAt };
  let changed = false;

  if (v.description.trim() !== initial.description.trim()) { payload.description = v.description.trim(); changed = true; }
  if (v.result.trim() !== initial.result.trim()) { payload.result = v.result.trim(); changed = true; }
  if (v.attachmentNotes.trim() !== initial.attachmentNotes.trim()) { payload.attachmentNotes = v.attachmentNotes.trim() || null; changed = true; }
  if (v.assignedToId !== initial.assignedToId) { payload.assignedToId = v.assignedToId || null; changed = true; }
  if (v.actionDateTime !== initial.actionDateTime) { payload.actionDateTime = new Date(v.actionDateTime).toISOString(); changed = true; }

  const flagChanged = v.followUpRequired !== initial.followUpRequired;
  const noteChanged = v.followUpNote.trim() !== initial.followUpNote.trim();
  if (flagChanged) { payload.followUpRequired = v.followUpRequired; changed = true; }
  if (flagChanged || noteChanged) {
    if (v.followUpRequired) { payload.followUpNote = v.followUpNote.trim(); changed = true; }
    else if (flagChanged) payload.followUpNote = null;
  }

  return changed ? payload : null;
}

const roleBadge = (role: string) => <span className="badge bg-secondary ms-1">{role}</span>;

function formatRevisionValue(key: string, value: unknown, assignees: AssigneeOption[]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "assignedToId") return assignees.find((a) => a.id === value)?.fullName || String(value);
  if (key === "actionDateTime") return formatDateTime(String(value));
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function changedFields(rev: ActionTakenRevision) {
  const original = rev.originalData || {};
  const updated = rev.updatedData || {};
  const keys = Array.from(new Set([...Object.keys(original), ...Object.keys(updated)]));
  return keys.filter((k) => JSON.stringify(original[k] ?? null) !== JSON.stringify(updated[k] ?? null));
}

const FOCUSABLE = "button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])";

interface ActionFormModalProps {
  mode: "create" | "edit";
  action?: ActionTaken;
  performer: { fullName: string; role: string };
  assignees: AssigneeOption[];
  onClose: () => void;
  onSubmit: (payload: CreateActionTakenInput | UpdateActionTakenInput, idempotencyKey?: string) => Promise<void>;
}

function ActionFormModal({ mode, action, performer, assignees, onClose, onSubmit }: ActionFormModalProps) {
  const isEdit = mode === "edit";
  const initialRef = useRef<FormValues>(isEdit && action ? valuesFromAction(action) : emptyValues());
  const [values, setValues] = useState<FormValues>(initialRef.current);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noteFocusTick, setNoteFocusTick] = useState(0);

  const dialogRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  // One Idempotency-Key per logical create submission; reused for retries of the unchanged payload.
  const keyRef = useRef<{ json: string; key: string } | null>(null);
  const openerRef = useRef<Element | null>(document.activeElement);

  const performerName = isEdit && action ? action.performedBy.fullName : performer.fullName;
  const performerRole = isEdit && action ? action.performedBy.role : performer.role;
  const titleId = `action-modal-title-${mode}`;

  useEffect(() => {
    mountedRef.current = true;
    descriptionRef.current?.focus();
    const opener = openerRef.current as HTMLElement | null;
    return () => {
      mountedRef.current = false;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, []);

  useEffect(() => {
    if (noteFocusTick > 0) noteRef.current?.focus();
  }, [noteFocusTick]);

  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleFollowUpToggle = (checked: boolean) => {
    setValues((prev) => ({ ...prev, followUpRequired: checked, followUpNote: checked ? prev.followUpNote : "" }));
    setErrors((prev) => ({ ...prev, followUpNote: undefined }));
    if (checked) setNoteFocusTick((t) => t + 1);
  };

  const requestClose = () => {
    if (!submittingRef.current) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;

    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !(el as HTMLButtonElement).disabled
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setFormError("");
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const order: (keyof FormValues)[] = ["actionDateTime", "description", "result", "followUpNote", "attachmentNotes"];
      const firstInvalid = order.find((k) => found[k]);
      if (firstInvalid) dialogRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }

    let payload: CreateActionTakenInput | UpdateActionTakenInput;
    let key: string | undefined;
    if (isEdit && action) {
      const built = buildUpdatePayload(values, initialRef.current, action.updatedAt);
      if (!built) {
        setFormError("No changes to save.");
        return;
      }
      payload = built;
    } else {
      payload = buildCreatePayload(values);
      const json = JSON.stringify(payload);
      if (!keyRef.current || keyRef.current.json !== json) keyRef.current = { json, key: newIdempotencyKey() };
      key = keyRef.current.key;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(payload, key);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const network = isEdit ? NETWORK_MESSAGE_EDIT : NETWORK_MESSAGE_CREATE;
      if (err instanceof ApiError) {
        if (err.code === "INACTIVE_ASSIGNEE" || err.code === "INVALID_ASSIGNEE_ROLE") setFormError(ASSIGNEE_MESSAGE);
        else if (err.code === "STALE_UPDATE") setFormError(STALE_MESSAGE);
        else if (err.status === 400) setFormError(err.message);
        else if (err.status === 403) setFormError("You do not have permission to perform this action.");
        else if (err.status === 404) setFormError("This record could not be found. Please reload the page.");
        else setFormError(network);
      } else {
        setFormError(network);
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const fieldProps = (name: keyof FormValues, id: string) => ({
    id,
    "data-field": name,
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `${id}-error` : undefined,
    className: `form-control${errors[name] ? " is-invalid" : ""}`
  });

  const fieldError = (name: keyof FormValues, id: string) =>
    errors[name] ? (
      <div id={`${id}-error`} className="invalid-feedback d-block" role="alert" style={{ color: "var(--color-danger)" }}>
        {errors[name]}
      </div>
    ) : null;

  const p = `action-${mode}`;

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div
        className="modal fade show d-block action-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg modal-fullscreen-sm-down">
          <div className="modal-content">
            <form onSubmit={handleSubmit} noValidate className="d-flex flex-column" style={{ minHeight: 0, flex: "1 1 auto" }}>
              <div className="modal-header">
                <h5 className="modal-title" id={titleId}>{isEdit ? "Edit Action Taken" : "Record Action Taken"}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={requestClose} disabled={submitting}></button>
              </div>

              <div className="modal-body">
                {formError && <div className="alert alert-danger" role="alert">{formError}</div>}

                {isEdit && (
                  <div className="alert alert-info py-2 small">
                    Edits to this action will be recorded in the append-only revision history. The original author and previous revisions are permanently preserved.
                  </div>
                )}

                <div className="mb-3">
                  <div className="form-label fw-bold mb-1">Performed By</div>
                  <div data-testid="performed-by" className="form-control-plaintext py-0">
                    {performerName}
                    {roleBadge(performerRole)}
                  </div>
                </div>

                <div className="row">
                  <div className="col-12 col-md-6 mb-3">
                    <label className="form-label fw-bold" htmlFor={`${p}-datetime`}>Action Date/Time</label>
                    <input type="datetime-local" {...fieldProps("actionDateTime", `${p}-datetime`)} value={values.actionDateTime} onChange={(e) => setValue("actionDateTime", e.target.value)} />
                    {!isEdit && !errors.actionDateTime && <div className="form-text">Leave blank to use the current time.</div>}
                    {fieldError("actionDateTime", `${p}-datetime`)}
                  </div>
                  <div className="col-12 col-md-6 mb-3">
                    <label className="form-label fw-bold" htmlFor={`${p}-assignee`}>Assigned To</label>
                    <select {...fieldProps("assignedToId", `${p}-assignee`)} className="form-select" value={values.assignedToId} onChange={(e) => setValue("assignedToId", e.target.value)}>
                      <option value="">Unassigned</option>
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>{a.fullName} ({a.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor={`${p}-description`}>Description <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <textarea rows={4} aria-required="true" {...fieldProps("description", `${p}-description`)} ref={descriptionRef} value={values.description} onChange={(e) => setValue("description", e.target.value)} />
                  {fieldError("description", `${p}-description`)}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor={`${p}-result`}>Result <span style={{ color: "var(--color-danger)" }}>*</span></label>
                  <textarea rows={3} aria-required="true" {...fieldProps("result", `${p}-result`)} value={values.result} onChange={(e) => setValue("result", e.target.value)} />
                  {fieldError("result", `${p}-result`)}
                </div>

                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id={`${p}-followup`} checked={values.followUpRequired} onChange={(e) => handleFollowUpToggle(e.target.checked)} />
                  <label className="form-check-label fw-bold" htmlFor={`${p}-followup`}>Follow-Up Required</label>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold" htmlFor={`${p}-followup-note`}>
                    Follow-Up Note {values.followUpRequired && <span style={{ color: "var(--color-danger)" }}>*</span>}
                  </label>
                  <textarea rows={2} aria-required={values.followUpRequired ? "true" : undefined} disabled={!values.followUpRequired} {...fieldProps("followUpNote", `${p}-followup-note`)} ref={noteRef} value={values.followUpNote} onChange={(e) => setValue("followUpNote", e.target.value)} />
                  {fieldError("followUpNote", `${p}-followup-note`)}
                </div>

                <div className="mb-2">
                  <label className="form-label fw-bold" htmlFor={`${p}-attachment-notes`}>Attachment Notes</label>
                  <textarea rows={2} {...fieldProps("attachmentNotes", `${p}-attachment-notes`)} value={values.attachmentNotes} onChange={(e) => setValue("attachmentNotes", e.target.value)} placeholder="Which file or image to look for" />
                  {fieldError("attachmentNotes", `${p}-attachment-notes`)}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary action-btn" onClick={requestClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-success action-btn" disabled={submitting}>
                  {submitting && (
                    <span className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Saving...</span>
                    </span>
                  )}
                  {isEdit ? "Save Changes" : "Record Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ActionsTakenSection({ ticketId, ticketStatus, isStaff, assignees = [], onCountChange }: ActionsTakenSectionProps) {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; action: ActionTaken } | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const isTerminal = TERMINAL_STATUSES.includes((ticketStatus || "").toUpperCase());

  const load = useCallback(async (showSpinner: boolean) => {
    const requestId = ++requestRef.current;
    if (showSpinner) setLoading(true);
    try {
      const res = await getActionsTaken(ticketId);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const list = res?.data || [];
      setActions(list);
      setLoadError(false);
      onCountChangeRef.current?.(list.length);
    } catch {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setLoadError(true);
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    mountedRef.current = true;
    setActions([]);
    load(true);
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const handleCreate = async (payload: CreateActionTakenInput | UpdateActionTakenInput, key?: string) => {
    await createActionTaken(ticketId, payload as CreateActionTakenInput, key);
    setModal(null);
    setToast("Action Taken recorded successfully.");
    await load(false);
  };

  const handleUpdate = async (action: ActionTaken, payload: CreateActionTakenInput | UpdateActionTakenInput) => {
    await updateActionTaken(action.id, payload as UpdateActionTakenInput);
    setModal(null);
    setToast("Action Taken updated successfully.");
    await load(false);
  };

  const renderCard = (action: ActionTaken, index: number) => {
    const revisions = isStaff ? action.revisions || [] : [];
    const isExpanded = !!expanded[action.id];
    return (
      <article key={action.id} className="action-taken-card" data-testid={`action-card-${action.id}`}>
        <div className="action-taken-card__header">
          <strong>{isStaff ? `Action Taken #${index + 1}` : "Action Taken"}</strong>
          <span className="d-flex align-items-center gap-2">
            <span className="text-muted small">{formatDateTime(action.actionDateTime)}</span>
            {isStaff && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary action-btn"
                aria-label={`Edit Action Taken #${index + 1}`}
                disabled={isTerminal}
                title={isTerminal ? "Actions cannot be edited on a closed, cancelled or rejected ticket." : "Edit this action"}
                onClick={() => { setToast(""); setModal({ mode: "edit", action }); }}
              >
                Edit
              </button>
            )}
          </span>
        </div>

        <div className="action-taken-card__performer">
          Performed by: <strong>{action.performedBy.fullName}</strong>{roleBadge(action.performedBy.role)}
        </div>
        <div className="action-taken-card__performer mb-2">
          Assigned to: <strong>{action.assignedTo ? action.assignedTo.fullName : "Unassigned"}</strong>
          {action.assignedTo && roleBadge(action.assignedTo.role)}
        </div>

        <div className="fw-bold small text-muted text-uppercase">Description</div>
        <div className="mb-2" style={{ whiteSpace: "pre-wrap" }}>{action.description}</div>
        <div className="fw-bold small text-muted text-uppercase">Result</div>
        <div className="mb-2" style={{ whiteSpace: "pre-wrap" }}>{action.result}</div>

        <div className="mb-2">
          {action.followUpRequired ? (
            <span className="action-pill action-pill--warn">Follow-up required</span>
          ) : (
            <span className="action-pill action-pill--ok">No follow-up required</span>
          )}
        </div>
        {action.followUpRequired && action.followUpNote && (
          <div className="mb-2">
            <span className="fw-bold small text-muted">Follow-Up Note: </span>
            <span style={{ whiteSpace: "pre-wrap" }}>{action.followUpNote}</span>
          </div>
        )}
        {action.attachmentNotes && (
          <div className="small">
            <span className="fw-bold text-muted">Attachment Notes: </span>
            <span style={{ whiteSpace: "pre-wrap" }}>{action.attachmentNotes}</span>
          </div>
        )}

        {revisions.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-sm btn-link p-0 action-btn"
              aria-expanded={isExpanded}
              aria-controls={`revisions-${action.id}`}
              onClick={() => setExpanded((prev) => ({ ...prev, [action.id]: !prev[action.id] }))}
            >
              {isExpanded ? "Hide" : "View"} Revision History ({revisions.length})
            </button>
            {isExpanded && (
              <ul id={`revisions-${action.id}`} className="list-unstyled border rounded p-2 mt-1 mb-0 small bg-light">
                {[...revisions]
                  .sort((a, b) => b.revisionNumber - a.revisionNumber)
                  .map((rev) => {
                    const fields = changedFields(rev);
                    return (
                      <li key={rev.id} className="mb-2">
                        <strong>Revision {rev.revisionNumber}</strong>
                        {" — "}
                        {formatDateTime(rev.editedAt)} by {rev.editor?.fullName || "Unknown"}
                        {fields.length === 0 ? (
                          <div className="text-muted">No field changes recorded.</div>
                        ) : (
                          <ul className="mb-0 ps-3">
                            {fields.map((k) => (
                              <li key={k}>
                                {FIELD_LABELS[k] || k}: “{formatRevisionValue(k, rev.originalData?.[k], assignees)}” → “{formatRevisionValue(k, rev.updatedData?.[k], assignees)}”
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}
      </article>
    );
  };

  const showErrorBlock = loadError && actions.length === 0;

  return (
    <section className="card shadow-sm mb-4" aria-label="Service Actions">
      {isStaff && (
        <div className="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0">{loading && actions.length === 0 ? "Service Actions" : `Service Actions (${actions.length})`}</h5>
          <button
            type="button"
            className="btn btn-success action-btn"
            disabled={isTerminal}
            title={isTerminal ? "Actions cannot be added to a closed, cancelled or rejected ticket." : "Record a new Action Taken"}
            onClick={() => { setToast(""); setModal({ mode: "create" }); }}
          >
            + Add Action Taken
          </button>
        </div>
      )}

      <div className="card-body">
        {toast && (
          <div className="alert alert-success alert-dismissible" role="status">
            {toast}
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setToast("")}></button>
          </div>
        )}

        {loading && actions.length === 0 && !loadError ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading service actions...</span>
            </div>
          </div>
        ) : showErrorBlock ? (
          <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
            <span>Unable to load service actions. Please try again.</span>
            <button type="button" className="btn btn-sm btn-outline-danger action-btn" onClick={() => load(true)}>Retry</button>
          </div>
        ) : (
          <>
            {loadError && (
              <div className="alert alert-warning d-flex justify-content-between align-items-center" role="alert">
                <span>Unable to refresh service actions. The list may be out of date.</span>
                <button type="button" className="btn btn-sm btn-outline-secondary action-btn" onClick={() => load(false)}>Retry</button>
              </div>
            )}
            {actions.length === 0 ? (
              <div className="text-center text-muted py-4">
                {isStaff ? (
                  <>
                    <p className="mb-2">No service actions recorded for this ticket.</p>
                    {!isTerminal && (
                      <button type="button" className="btn btn-outline-success action-btn" onClick={() => setModal({ mode: "create" })}>
                        + Add the first Action Taken
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mb-1">No service actions recorded yet.</p>
                    <p className="mb-0 small">IT Staff will log actions as work progresses.</p>
                  </>
                )}
              </div>
            ) : (
              actions.map(renderCard)
            )}
          </>
        )}
      </div>

      {isStaff && modal && (
        <ActionFormModal
          key={modal.mode === "edit" ? `edit-${modal.action.id}` : "create"}
          mode={modal.mode}
          action={modal.mode === "edit" ? modal.action : undefined}
          performer={{ fullName: user?.fullName || "You", role: user?.role || "IT_STAFF" }}
          assignees={assignees}
          onClose={() => setModal(null)}
          onSubmit={(payload, key) => (modal.mode === "edit" ? handleUpdate(modal.action, payload) : handleCreate(payload, key))}
        />
      )}
    </section>
  );
}
