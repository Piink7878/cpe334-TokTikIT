import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTicket, Ticket, getPublicComments, addPublicComment, indicateProblemResolved, getActionsTaken } from "../api";
import { createKeyTracker } from "../idempotency";
import { AttachmentSection } from "../components/AttachmentSection";
import ActionsTakenSection from "../components/ActionsTakenSection";

export const RequesterTicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedRequester = user;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [actionsCount, setActionsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("attachments");
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentKeys = useRef(createKeyTracker()).current;
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  // `error` means the ticket could not be loaded and replaces the page. A failed comment or action is shown inline
  // (`actionError`) so the form and what the user typed stay available for a retry.
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchTicket = async () => {
    if (!selectedRequester || !id) return;
    setIsLoading(true);
    try {
      const ticketIdNum = parseInt(id, 10);
      const [ticketRes, commentsRes, actionsRes] = await Promise.all([
        getTicket(ticketIdNum),
        getPublicComments(ticketIdNum),
        // The tab count is informational; a failure here must not block the ticket page.
        Promise.resolve(getActionsTaken(ticketIdNum)).catch(() => null)
      ]);
      setTicket(ticketRes.data);
      setComments(commentsRes.data);
      setActionsCount(actionsRes?.data?.length ?? 0);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load ticket details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticket) return;
    setSubmittingComment(true);
    setActionError("");
    try {
      await addPublicComment(ticket.id, newComment, commentKeys.keyFor(`${ticket.id}|${newComment.trim()}`));
      commentKeys.reset();
      setSuccessMsg("Comment added successfully.");
      setNewComment("");
      try {
        const commentsRes = await getPublicComments(ticket.id);
        setComments(commentsRes.data);
      } catch {
        // The comment is saved; only the list refresh failed. Say so, so the user does not post it again.
        setActionError("Your comment was saved, but the list could not be refreshed. Reload the page to see it.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleIndicateResolved = async () => {
    if (!ticket) return;
    setActionLoading(true);
    setActionError("");
    try {
      await indicateProblemResolved(ticket.id);
      setSuccessMsg("Notified IT Staff that the problem appears resolved.");
      const commentsRes = await getPublicComments(ticket.id);
      setComments(commentsRes.data);
    } catch (err: any) {
      setActionError(err.message || "Failed to notify IT staff.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id, selectedRequester]);

  if (isLoading) {
    return (
      <div className="container py-4">
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger" role="alert" style={{ backgroundColor: '#FDF2F2', color: '#D32F2F', borderColor: '#D32F2F' }}>
          {error || "Ticket not found"}
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/my-tickets')} style={{ backgroundColor: '#FFFFFF', borderColor: '#0B7A46', color: '#0B7A46' }}>
          Back to My Tickets
        </button>
      </div>
    );
  }

  const readOnlyStyle = {
    backgroundColor: '#F0F4F2',
    border: '1px solid #E0E5E2',
    color: '#5B6B64',
    cursor: 'not-allowed'
  };

  const badgeStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case "NEW": return { color: '#006B3C', backgroundColor: '#EAF6EF', border: '1px solid #BCE3CE' };
      case "IN_PROGRESS": case "OPEN": return { color: '#1D4ED8', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' };
      case "PENDING": case "MEDIUM": return { color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' };
      case "HIGH": case "CRITICAL": return { color: '#B91C1C', backgroundColor: '#FEE2E2', border: '1px solid #FECACA' };
      case "LOW": return { color: '#4B5563', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' };
      case "RESOLVED": case "CLOSED": return { color: '#065F46', backgroundColor: '#D1FAE5', border: '1px solid #A7F3D0' };
      default: return { color: '#4B5563', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' };
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '1200px' }}>
      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      {successMsg && <div className="alert alert-success alert-dismissible fade show" role="status">{successMsg}<button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setSuccessMsg("")}></button></div>}
      
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1">
              <li className="breadcrumb-item" style={{ color: '#0B7A46', cursor: 'pointer' }} onClick={() => navigate('/my-tickets')}>My Tickets</li>
              <li className="breadcrumb-item active" aria-current="page" style={{ color: '#5B6B64' }}>Ticket Details</li>
            </ol>
          </nav>
          <h1 className="h3 mb-0" style={{ color: '#1A2E22', fontWeight: 700 }}>Ticket Details</h1>
        </div>
        <div className="d-flex gap-2">
          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && ticket.status !== 'REJECTED' && ticket.status !== 'CANCELLED' && (
            <button 
              className="btn btn-outline-success" 
              onClick={handleIndicateResolved}
              disabled={actionLoading}
              style={{ color: '#0B7A46', borderColor: '#0B7A46' }}
            >
              {actionLoading ? "Processing..." : "Problem Appears Resolved"}
            </button>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/my-tickets')}
            style={{ backgroundColor: '#FFFFFF', borderColor: '#0B7A46', color: '#0B7A46' }}
          >
            Back to My Tickets
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '8px', backgroundColor: '#FFFFFF' }}>
        <div className="card-body p-4">
          
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Ticket No</label>
              <div className="form-control" style={readOnlyStyle}>{ticket.ticketNumber}</div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Ticket Date</label>
              <div className="form-control" style={readOnlyStyle}>{new Date(ticket.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Category</label>
              <div className="form-control" style={readOnlyStyle}>{ticket.category.name}</div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Related System</label>
              <div className="form-control" style={readOnlyStyle}>{ticket.relatedSystem?.name || 'None'}</div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Requester Name</label>
              <div className="form-control" style={readOnlyStyle}>{ticket.requester?.name}</div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Requested Priority</label>
              <div className="form-control" style={readOnlyStyle}>
                <span className="badge rounded-pill" style={badgeStyle(ticket.requestedPriority)}>{ticket.requestedPriority}</span>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>IT Priority</label>
              <div className="form-control" style={readOnlyStyle}>
                <span className="badge rounded-pill" style={badgeStyle(ticket.itPriority)}>{ticket.itPriority}</span>
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Current Status</label>
              <div className="form-control" style={readOnlyStyle}>
                <span className="badge rounded-pill" style={badgeStyle(ticket.status)}>{ticket.status}</span>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Summary</label>
            <div className="form-control" style={{ ...readOnlyStyle, height: 'auto', minHeight: '38px' }}>
              {ticket.summary}
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22' }}>Description</label>
            <div className="form-control" style={{ ...readOnlyStyle, height: 'auto', minHeight: '100px', whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </div>
          </div>

          {/* Navigation Tabs (Sub-sections) */}
          <ul className="nav nav-tabs" style={{ borderBottomColor: '#E0E5E2' }}>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'comments' ? 'active' : ''}`} 
                onClick={() => setActiveTab('comments')}
                style={activeTab === 'comments' ? { color: '#0B7A46', fontWeight: 600, borderBottom: '2px solid #0B7A46', borderTop: 'none', borderLeft: 'none', borderRight: 'none', backgroundColor: 'transparent' } : { color: '#5B6B63', backgroundColor: 'transparent', border: 'none' }}
              >
                Public Comments ({comments.length})
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${activeTab === 'attachments' ? 'active' : ''}`}
                onClick={() => setActiveTab('attachments')}
                style={activeTab === 'attachments' ? { color: '#0B7A46', fontWeight: 600, borderBottom: '2px solid #0B7A46', borderTop: 'none', borderLeft: 'none', borderRight: 'none', backgroundColor: 'transparent' } : { color: '#5B6B63', backgroundColor: 'transparent', border: 'none' }}
              >
                Attachments ({ticket.attachments ? ticket.attachments.filter(a => !a.isRemoved).length : 0})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'actions' ? 'active' : ''}`}
                onClick={() => setActiveTab('actions')}
                style={activeTab === 'actions' ? { color: '#0B7A46', fontWeight: 600, borderBottom: '2px solid #0B7A46', borderTop: 'none', borderLeft: 'none', borderRight: 'none', backgroundColor: 'transparent' } : { color: '#5B6B63', backgroundColor: 'transparent', border: 'none' }}
              >
                Service Actions ({actionsCount})
              </button>
            </li>
          </ul>

          {/* Active Tab Content */}
          <div className="tab-content pt-4">
            {activeTab === 'attachments' && (
              <AttachmentSection 
                ticketId={ticket.id} 
                attachments={ticket.attachments || []} 
                onAttachmentUpdate={fetchTicket} 
              />
            )}
            {activeTab === 'actions' && (
              <ActionsTakenSection
                ticketId={ticket.id}
                ticketStatus={ticket.status}
                isStaff={false}
                onCountChange={setActionsCount}
              />
            )}
            {activeTab === 'comments' && (
              <div>
                {comments.length === 0 ? (
                  <p className="text-muted text-center py-4">No comments yet.</p>
                ) : (
                  <div className="d-flex flex-column gap-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="border rounded p-3 bg-light">
                        <div className="d-flex justify-content-between mb-2">
                          <strong><i className="bi bi-person-circle me-2"></i>{c.author.fullName}</strong>
                          <span className="text-muted small">{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="card shadow-sm border-0 bg-white mt-4" style={{ borderTop: "4px solid #0B7A46" }}>
                  <div className="card-body">
                    <h6 className="mb-3" style={{ color: "#0B7A46" }}>Add a Comment</h6>
                    <form onSubmit={handleAddComment}>
                      <textarea 
                        className="form-control mb-3" 
                        rows={3}
                        placeholder="Type your message to IT staff..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        style={{ backgroundColor: "#F0F4F2" }}
                      />
                      <div className="text-end">
                        <button type="submit" className="btn btn-success" style={{ backgroundColor: "#0B7A46" }} disabled={!newComment.trim() || submittingComment}>
                          {submittingComment ? "Posting..." : "Post Comment"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
