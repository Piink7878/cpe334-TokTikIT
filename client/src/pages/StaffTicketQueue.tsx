import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getStaffTickets, getCategories, StaffTicket, StaffTicketFilters, Category } from "../api";
import { useAuth } from "../contexts/AuthContext";

export default function StaffTicketQueue() {
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchFilters = useCallback(async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters: StaffTicketFilters = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      
      if (search.trim()) filters.search = search.trim();
      if (status) filters.status = status;
      if (priority) filters.itPriority = priority; // Filtering by IT priority
      if (categoryId) filters.categoryId = parseInt(categoryId, 10);
      if (ownerId) filters.ownerId = ownerId;
      
      const res = await getStaffTickets(filters);
      setTickets(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, priority, categoryId, ownerId, sortBy, sortOrder]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case "CRITICAL": return "text-bg-danger";
      case "HIGH": return "text-bg-warning";
      case "MEDIUM": return "text-bg-primary";
      case "LOW": return "text-bg-info";
      default: return "text-bg-secondary";
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case "NEW": return "text-bg-success";
      case "OPEN": return "text-bg-primary";
      case "IN_PROGRESS": return "text-bg-warning";
      case "WAITING_FOR_REQUESTER": return "text-bg-info";
      case "RESOLVED": return "text-bg-dark";
      case "CLOSED": return "text-bg-secondary";
      default: return "text-bg-light";
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>IT Staff Ticket Queue</h2>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch} className="row g-3">
            <div className="col-md-3">
              <label htmlFor="search" className="form-label visually-hidden">Search</label>
              <input 
                type="text" 
                className="form-control" 
                id="search" 
                placeholder="Search ticket number or summary" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="col-md-2">
              <select className="form-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="col-md-2">
              <select className="form-select" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}>
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="col-md-2">
              <select className="form-select" value={ownerId} onChange={e => { setOwnerId(e.target.value); setPage(1); }}>
                <option value="">Any Owner</option>
                <option value="unassigned">Unassigned</option>
                <option value={user?.id}>My Tickets</option>
              </select>
            </div>

            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100">Search</button>
            </div>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading queue...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card text-center shadow-sm py-5">
          <div className="card-body">
            <h5 className="text-muted">No tickets found.</h5>
            <p className="text-muted mb-0">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive d-none d-md-block">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Ticket No</th>
                  <th>Created Date</th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Req Priority</th>
                  <th>IT Priority</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td><strong>{ticket.ticketNumber}</strong></td>
                    <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td>{ticket.summary}</td>
                    <td>{ticket.category.name}</td>
                    <td><span className={`badge ${getPriorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span></td>
                    <td><span className={`badge ${getPriorityBadgeClass(ticket.itPriority)}`}>{ticket.itPriority}</span></td>
                    <td><span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</span></td>
                    <td>{ticket.owner ? ticket.owner.name : <span className="text-muted fst-italic">Unassigned</span>}</td>
                    <td>
                      <Link to={`/staff/tickets/${ticket.id}`} className="btn btn-sm btn-outline-primary">
                        Open Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Mobile view */}
          <div className="d-block d-md-none">
            <ul className="list-group list-group-flush">
              {tickets.map(ticket => (
                <li key={ticket.id} className="list-group-item p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong className="text-primary">{ticket.ticketNumber}</strong>
                    <span className={`badge ${getStatusBadgeClass(ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mb-2 text-truncate" style={{ maxWidth: "100%" }}>
                    {ticket.summary}
                  </div>
                  <div className="d-flex flex-wrap gap-2 mb-3 text-muted small">
                    <span><strong>IT Pri:</strong> <span className={`badge ${getPriorityBadgeClass(ticket.itPriority)}`}>{ticket.itPriority}</span></span>
                    <span><strong>Owner:</strong> {ticket.owner ? ticket.owner.name : 'Unassigned'}</span>
                  </div>
                  <Link to={`/staff/tickets/${ticket.id}`} className="btn btn-sm btn-outline-primary w-100">
                    Open Detail
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <nav aria-label="Ticket queue pagination" className="mt-4">
          <ul className="pagination justify-content-center">
            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </button>
            </li>
            {[...Array(totalPages)].map((_, i) => (
              <li key={i} className={`page-item ${page === i + 1 ? 'active' : ''}`}>
                <button className="page-link" onClick={() => setPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
            <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
