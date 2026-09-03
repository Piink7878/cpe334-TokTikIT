import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getTickets, getCategories, Category, Ticket, TicketFilters, PaginatedResponse } from "../api";
import { useRequester } from '../contexts/RequesterContext';

export default function MyTickets() {
  const { selectedRequester } = useRequester();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    pageSize: 8,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const [pagination, setPagination] = useState<PaginatedResponse<Ticket>['pagination']>({
    page: 1,
    pageSize: 8,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const [hasNeverCreatedTicket, setHasNeverCreatedTicket] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(console.error);
  }, []);

  const loadTickets = useCallback(async () => {
    if (!selectedRequester) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await getTickets(selectedRequester.id, filters);
      setTickets(response.data);
      setPagination(response.pagination);
      
      const isFilterActive = !!filters.search || !!filters.categoryId || !!filters.requestedPriority || !!filters.itPriority || !!filters.status;
      if (response.pagination.totalItems === 0 && !isFilterActive) {
        setHasNeverCreatedTicket(true);
      } else {
        setHasNeverCreatedTicket(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [selectedRequester, filters]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'sort') {
      const [sortBy, sortOrder] = value.split('-');
      setFilters(prev => ({ ...prev, sortBy, sortOrder: sortOrder as 'asc' | 'desc', page: 1 }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
    }
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      pageSize: 8,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }));
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'badge-low';
      case 'MEDIUM': return 'badge-pending';
      case 'HIGH':
      case 'CRITICAL': return 'badge-high';
      default: return 'badge-status';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'NEW': return 'badge-new';
      case 'IN_PROGRESS': return 'badge-pending';
      case 'RESOLVED':
      case 'CLOSED': return 'badge-resolved';
      default: return 'badge-status';
    }
  };

  if (!selectedRequester) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">Please select a requester first.</div>
      </div>
    );
  }

  const isFilterActive = !!filters.search || !!filters.categoryId || !!filters.requestedPriority || !!filters.itPriority || !!filters.status;

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div>
          <h2 className="mb-1" style={{ fontSize: '24px', fontWeight: 700 }}>My Tickets</h2>
          <p className="mb-0 text-muted" style={{ fontSize: '14px' }}>View and track all of your support requests.</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex gap-2">
          <Link to="/create-ticket" className="btn btn-primary">
            + Create Ticket
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="me-2 flex-shrink-0" viewBox="0 0 16 16">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
          <div>
            <strong>Error:</strong> <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card mb-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
        <div className="card-body p-3">
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </span>
                <input 
                  type="text" 
                  className="form-control border-start-0 ps-0" 
                  placeholder="Search..." 
                  name="search"
                  value={filters.search || ''}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            
            <div className="col-12 col-sm-6 col-md-2">
              <select className="form-select" name="categoryId" value={filters.categoryId || ''} onChange={handleFilterChange} aria-label="Category">
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="col-12 col-sm-6 col-md-2">
              <select className="form-select" name="requestedPriority" value={filters.requestedPriority || ''} onChange={handleFilterChange} aria-label="Requested Priority">
                <option value="">All Req. Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            
            <div className="col-12 col-sm-6 col-md-2">
              <select className="form-select" name="status" value={filters.status || ''} onChange={handleFilterChange} aria-label="Status">
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="col-12 col-sm-6 col-md-2">
              <select className="form-select" name="sort" value={`${filters.sortBy}-${filters.sortOrder}`} onChange={handleFilterChange} aria-label="Sort By">
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="ticketNumber-asc">Ticket Number (A-Z)</option>
                <option value="ticketNumber-desc">Ticket Number (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: 'var(--color-primary)' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : hasNeverCreatedTicket ? (
        <div className="text-center py-5" style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px dashed var(--color-border-subtle)' }}>
          <div className="mb-3 text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
              <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
            </svg>
          </div>
          <h4>No tickets found</h4>
          <p className="text-muted mb-4">You haven't submitted any support tickets yet. Click below to get started.</p>
          <Link to="/create-ticket" className="btn btn-primary">+ Create Your First Ticket</Link>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-5" style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
          <h4>No matching tickets</h4>
          <p className="text-muted mb-4">No tickets matched your current search and filter criteria. Try adjusting or clearing your filters.</p>
          <button className="btn btn-outline-secondary" onClick={handleClearFilters}>Clear All Filters</button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="d-none d-lg-block table-responsive" style={{ backgroundColor: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
            <table className="table table-hover mb-0" style={{ margin: 0 }}>
              <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                <tr>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>TICKET NO.</th>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>CREATED</th>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>SUMMARY</th>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>CATEGORY</th>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>PRIORITY</th>
                  <th className="px-3 py-3" style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: '13px', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td className="px-3 py-3" style={{ fontSize: '14px', fontWeight: 500 }}>
                      <Link to={`/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'var(--color-primary)' }}>
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3" style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-truncate-2" style={{ maxWidth: '300px', fontSize: '14px' }}>
                      {ticket.summary}
                    </td>
                    <td className="px-3 py-3" style={{ fontSize: '14px' }}>{ticket.category?.name || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`badge-status ${getPriorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority.toLowerCase()}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge-status ${getStatusBadgeClass(ticket.status)}`}>{ticket.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="d-lg-none mb-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="ticket-mobile-card">
                <div className="ticket-mobile-header">
                  <Link to={`/tickets/${ticket.id}`} style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                    {ticket.ticketNumber}
                  </Link>
                  <span className={`badge-status ${getStatusBadgeClass(ticket.status)}`}>{ticket.status.replace('_', ' ')}</span>
                </div>
                <h3 className="ticket-mobile-title">{ticket.summary}</h3>
                <div className="ticket-mobile-meta mt-2">
                  <span style={{ backgroundColor: 'var(--color-surface-muted)', padding: '2px 8px', borderRadius: '4px' }}>
                    {ticket.category?.name || '-'}
                  </span>
                  <span style={{ backgroundColor: 'var(--color-surface-muted)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                    </svg>
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`badge-status ${getPriorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority.toLowerCase()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="d-flex justify-content-between align-items-center mt-4">
            <div className="text-muted" style={{ fontSize: '14px' }}>
              Showing {(pagination.page - 1) * pagination.pageSize + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} results
            </div>
            <div className="btn-group">
              <button 
                className="btn btn-outline-secondary btn-sm" 
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPreviousPage}
              >
                &lt; Previous
              </button>
              <button className="btn btn-primary btn-sm" disabled>{pagination.page}</button>
              <button 
                className="btn btn-outline-secondary btn-sm" 
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next &gt;
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
