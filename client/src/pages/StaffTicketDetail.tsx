import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  getStaffTicketDetail, 
  getStaffAssignees, 
  claimTicket, 
  assignTicket, 
  updateTicketPriority, 
  updateTicketStatus,
  addPublicComment,
  addInternalNote
} from "../api";
import { useAuth } from "../contexts/AuthContext";

type Ticket = any;
type User = { id: string; fullName: string; role: string };

const STATUS_BADGE_COLORS: Record<string, string> = {
  NEW: "bg-info text-dark",
  OPEN: "bg-primary text-white",
  IN_PROGRESS: "bg-warning text-dark",
  WAITING_FOR_REQUESTER: "bg-secondary text-white",
  RESOLVED: "bg-success text-white",
  CLOSED: "bg-dark text-white",
  REOPENED: "bg-danger text-white",
  CANCELLED: "bg-secondary text-white",
  REJECTED: "bg-danger text-white"
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-secondary text-white",
  MEDIUM: "bg-primary text-white",
  HIGH: "bg-warning text-dark",
  CRITICAL: "bg-danger text-white"
};

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [assigneeId, setAssigneeId] = useState("");
  const [itPriority, setItPriority] = useState("");
  const [newStatus, setNewStatus] = useState("");
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [publicCommentText, setPublicCommentText] = useState("");
  const [internalNoteText, setInternalNoteText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  const handleAddPublicComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await addPublicComment(ticket.id, publicCommentText);
      setSuccessMsg("Public comment added successfully");
      setPublicCommentText("");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add public comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;
    setSubmittingNote(true);
    try {
      await addInternalNote(ticket.id, internalNoteText);
      setSuccessMsg("Internal note added successfully");
      setInternalNoteText("");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add internal note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const fetchTicketAndAssignees = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const ticketId = parseInt(id as string, 10);
      const [ticketRes, assigneesRes] = await Promise.all([
        getStaffTicketDetail(ticketId),
        getStaffAssignees()
      ]);
      setTicket(ticketRes);
      setAssignees(assigneesRes.data);
      setAssigneeId(ticketRes.owner?.id || "");
      setItPriority(ticketRes.itPriority);
      setNewStatus(ticketRes.status);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketAndAssignees();
  }, [id]);

  const handleClaim = async () => {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await claimTicket(ticket.id);
      setSuccessMsg("Ticket claimed successfully");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to claim ticket");
    }
  };

  const handleAssign = async () => {
    if (!assigneeId) return;
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await assignTicket(ticket.id, assigneeId);
      setSuccessMsg("Ticket assigned successfully");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to assign ticket");
    }
  };

  const handleUpdatePriority = async () => {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await updateTicketPriority(ticket.id, itPriority);
      setSuccessMsg("Priority updated successfully");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update priority");
    }
  };

  const handleUpdateStatus = async () => {
    if (newStatus === "REJECTED") {
      setShowRejectModal(true);
      return;
    }
    await executeStatusUpdate(newStatus);
  };

  const executeStatusUpdate = async (status: string, reason?: string) => {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      await updateTicketStatus(ticket.id, status, reason);
      setSuccessMsg("Status updated successfully");
      setShowRejectModal(false);
      setRejectionReason("");
      await fetchTicketAndAssignees();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status");
      setShowRejectModal(false);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg("Rejection reason is required");
      return;
    }
    executeStatusUpdate("REJECTED", rejectionReason);
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger">{errorMsg}</div>
        <Link to="/staff-queue" className="btn btn-outline-primary">Back to Queue</Link>
      </div>
    );
  }

  const allowedTransitions: Record<string, string[]> = {
    NEW: ["OPEN", "REJECTED", "CANCELLED"],
    OPEN: ["RESOLVED", "CANCELLED", "IN_PROGRESS", "WAITING_FOR_REQUESTER"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    REOPENED: ["RESOLVED", "CANCELLED", "IN_PROGRESS", "WAITING_FOR_REQUESTER"],
    CLOSED: [],
    REJECTED: [],
    CANCELLED: []
  };

  const permittedNext = allowedTransitions[ticket.status] || [];

  const combinedActivity = [
    ...(ticket.publicComments || []).map((pc: any) => ({ ...pc, type: 'public' })),
    ...(ticket.internalNotes || []).map((note: any) => ({ ...note, type: 'internal' }))
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="container py-5">
      {successMsg && <div className="alert alert-success alert-dismissible fade show">{successMsg}<button type="button" className="btn-close" onClick={() => setSuccessMsg("")}></button></div>}
      {errorMsg && <div className="alert alert-danger alert-dismissible fade show">{errorMsg}<button type="button" className="btn-close" onClick={() => setErrorMsg("")}></button></div>}
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{ticket.ticketNumber} <span className={`badge ms-2 fs-6 ${STATUS_BADGE_COLORS[ticket.status]}`}>{ticket.status.replace(/_/g, " ")}</span></h2>
        <Link to="/staff-queue" className="btn btn-outline-secondary">Back to Queue</Link>
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h4 className="card-title">{ticket.summary}</h4>
              <hr />
              <p className="card-text" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p>
            </div>
            <div className="card-footer text-muted small d-flex gap-3">
              <span><strong>Category:</strong> {ticket.category.name}</span>
              <span><strong>System:</strong> {ticket.relatedSystem.name}</span>
              <span><strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">Activity & Communication</h5>
            </div>
            <div className="card-body">
              {combinedActivity.length === 0 ? (
                <p className="text-muted text-center mb-0">No activity recorded yet.</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {combinedActivity.map((item: any) => (
                    item.type === 'public' ? (
                      <div key={`pc-${item.id}`} className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong><i className="bi bi-chat-text me-1"></i> {item.author.fullName} <span className="badge bg-secondary ms-2">Public Comment</span></strong>
                          <span className="text-muted small">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>
                      </div>
                    ) : (
                      <div key={`note-${item.id}`} className="border rounded p-3 bg-light" style={{ borderColor: "var(--color-primary) !important", borderLeft: "4px solid var(--color-primary)" }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <strong className="text-primary"><i className="bi bi-journal-text me-1"></i> {item.author.fullName} <span className="badge bg-primary ms-2">Internal Note</span></strong>
                          <span className="text-muted small">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="row">
            <div className="col-12 col-xl-6 mb-4 mb-xl-0">
              <div className="card shadow-sm h-100 border-0" style={{ borderTop: "4px solid #0B7A46" }}>
                <div className="card-header bg-white border-0 pt-4">
                  <h5 className="mb-0" style={{ color: "#0B7A46" }}><i className="bi bi-chat-text me-2"></i>Post Public Comment</h5>
                  <small className="text-muted">Visible to the Requester</small>
                </div>
                <div className="card-body">
                  <form onSubmit={handleAddPublicComment}>
                    <div className="mb-3">
                      <textarea 
                        className="form-control" 
                        rows={4} 
                        placeholder="Write a message to the requester..."
                        value={publicCommentText}
                        onChange={e => setPublicCommentText(e.target.value)}
                        style={{ backgroundColor: "#F8F9FA" }}
                      ></textarea>
                    </div>
                    <div className="text-end">
                      <button type="submit" className="btn btn-outline-success" disabled={submittingComment || !publicCommentText.trim()}>
                        {submittingComment ? "Posting..." : "Post Comment"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-6">
              <div className="card shadow-sm h-100 border-0" style={{ backgroundColor: "#FFF8E1", borderTop: "4px solid #FFC107" }}>
                <div className="card-header border-0 pt-4" style={{ backgroundColor: "#FFF8E1" }}>
                  <h5 className="mb-0 text-dark"><i className="bi bi-journal-text me-2"></i>Add Internal Note</h5>
                  <small className="text-muted">Private - IT Staff & Admin only</small>
                </div>
                <div className="card-body">
                  <form onSubmit={handleAddInternalNote}>
                    <div className="mb-3">
                      <textarea 
                        className="form-control" 
                        rows={4} 
                        placeholder="Write an internal operational note..."
                        value={internalNoteText}
                        onChange={e => setInternalNoteText(e.target.value)}
                        style={{ backgroundColor: "#FFFFFF", borderColor: "#FFE082" }}
                      ></textarea>
                    </div>
                    <div className="text-end">
                      <button type="submit" className="btn btn-warning" disabled={submittingNote || !internalNoteText.trim()}>
                        {submittingNote ? "Saving..." : "Save Internal Note"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">Requester Details</h5>
            </div>
            <div className="card-body">
              <p className="mb-1"><strong>Name:</strong> {ticket.requester.fullName}</p>
              <p className="mb-0"><strong>Email:</strong> {ticket.requester.email}</p>
            </div>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">Operations Panel</h5>
            </div>
            <div className="card-body">
              
              <div className="mb-4">
                <label className="form-label fw-bold" htmlFor="assignee-select">Assignment</label>
                {ticket.owner ? (
                  <div className="mb-2">Current: <strong>{ticket.owner.fullName}</strong></div>
                ) : (
                  <div className="mb-2 text-muted">Unassigned</div>
                )}
                
                <div className="d-flex gap-2">
                  <select 
                    id="assignee-select"
                    className="form-select" 
                    value={assigneeId} 
                    onChange={e => setAssigneeId(e.target.value)}
                  >
                    <option value="">-- Select Assignee --</option>
                    {assignees.map(a => (
                      <option key={a.id} value={a.id}>{a.fullName} ({a.role})</option>
                    ))}
                  </select>
                  <button className="btn btn-primary text-nowrap" onClick={handleAssign} disabled={!assigneeId || assigneeId === ticket.owner?.id}>Assign</button>
                </div>
                {ticket.owner?.id !== user?.id && (
                  <button className="btn btn-outline-primary mt-2 w-100" onClick={handleClaim}>
                    Claim Ticket
                  </button>
                )}
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold" htmlFor="priority-select">IT Priority</label>
                <div className="mb-2">Requested: <span className={`badge ${PRIORITY_COLORS[ticket.requestedPriority]}`}>{ticket.requestedPriority}</span></div>
                <div className="d-flex gap-2">
                  <select id="priority-select" className="form-select" value={itPriority} onChange={e => setItPriority(e.target.value)}>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <button className="btn btn-primary" onClick={handleUpdatePriority} disabled={itPriority === ticket.itPriority}>Update</button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold" htmlFor="status-select">Status Transition</label>
                {permittedNext.length === 0 ? (
                  <div className="alert alert-secondary py-2">No further transitions allowed from {ticket.status}.</div>
                ) : (
                  <div className="d-flex gap-2">
                    <select id="status-select" className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      <option value={ticket.status} disabled>{ticket.status.replace(/_/g, " ")}</option>
                      {permittedNext.map(st => (
                        <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <button className="btn btn-warning" onClick={handleUpdateStatus} disabled={newStatus === ticket.status}>Change</button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {showRejectModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Reject Ticket</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowRejectModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p>Please provide a reason for rejecting this ticket. This will be recorded as an internal note.</p>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Enter rejection reason..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  ></textarea>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleRejectSubmit} disabled={!rejectionReason.trim()}>Reject Ticket</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
