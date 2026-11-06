import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getStaffDashboard, StaffDashboardData } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { KpiCard, KpiSkeletons, DashboardError, ForbiddenCard, formatStatus, statusBadgeClass, priorityBadgeClass } from "../components/DashboardParts";

// Status set behind "unresolved" in every staff metric (specification.md §8.2).
const UNRESOLVED = "NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED";
const ALL_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "REJECTED"];

export default function StaffDashboard() {
  const { user } = useAuth();
  const isStaff = user?.role === "IT_STAFF" || user?.role === "ADMIN";
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStaffDashboard();
      setData(res.data);
    } catch {
      setError("Unable to load dashboard metrics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStaff) fetchDashboard();
  }, [isStaff, fetchDashboard]);

  if (!isStaff) {
    return <ForbiddenCard dashboardName="IT Staff Dashboard" backTo="/" backLabel="Go to my home page" />;
  }

  const recent = data?.recentTickets ?? [];
  const actions = data?.currentUserActions ?? [];

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h1 className="h2 mb-1 fw-bold">IT Staff Dashboard</h1>
          <p className="mb-0 text-muted" style={{ fontSize: 14 }}>
            Operational overview of queue workload, attention items and your recent actions.
          </p>
        </div>
        <Link to="/staff-queue" className="btn btn-outline-success fw-medium mt-3 mt-md-0">Ticket Queue &rarr;</Link>
      </div>

      {user?.role === "ADMIN" && (
        <div className="alert alert-light border mb-4" role="note">
          Administrator view: this dashboard shows the full operational queue. Manage user accounts under{" "}
          <Link to="/user-management">User Management</Link>.
        </div>
      )}

      {error && <DashboardError message={error} onRetry={fetchDashboard} />}

      {loading ? (
        <KpiSkeletons />
      ) : data ? (
        <>
          <div className="row g-3 mb-4">
            <KpiCard title="Unassigned Tickets" value={data.unassignedTickets} caption="Waiting for an owner" to="/staff-queue?ownerId=unassigned&status=NEW,OPEN" />
            <KpiCard title="My Active Tickets" value={data.myActiveTickets} caption="Assigned to you" to={`/staff-queue?ownerId=me&status=OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`} />
            <KpiCard title="Follow-Up Required" value={data.ticketsRequiringFollowUp} caption="Tickets needing follow-up" to={`/staff-queue?followUpRequired=true&status=${UNRESOLVED}`} />
            <KpiCard title="Critical / High Priority" value={data.criticalOrHighPriorityTickets} caption="Urgent unresolved tickets" to={`/staff-queue?itPriority=CRITICAL,HIGH&status=${UNRESOLVED}`} />
          </div>

          <section className="card shadow-sm border-0 mb-4" style={{ borderRadius: 12 }} aria-labelledby="status-breakdown-heading">
            <div className="card-body p-4">
              <h2 id="status-breakdown-heading" className="h5 fw-bold mb-3">Queue Status Breakdown</h2>
              <div className="d-flex flex-wrap gap-2">
                {ALL_STATUSES.map((status) => (
                  <Link
                    key={status}
                    to={`/staff-queue?status=${status}`}
                    className={`btn btn-sm ${statusBadgeClass(status)} text-decoration-none d-inline-flex align-items-center gap-2 px-3 py-2`}
                    style={{ borderRadius: 22, fontWeight: 600, minHeight: 44 }}
                    aria-label={`${formatStatus(status)}: ${data.statusBreakdown?.[status] ?? 0}`}
                  >
                    <span>{formatStatus(status)}:</span>
                    <span className="badge bg-white text-dark rounded-pill px-2">{data.statusBreakdown?.[status] ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div className="row g-4">
        <section className="col-12 col-lg-6" aria-labelledby="recent-queue-heading">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
              <h2 id="recent-queue-heading" className="h5 mb-0 fw-bold">Recent Queue Tickets</h2>
              <Link to="/staff-queue" className="btn btn-sm btn-link text-decoration-none text-success fw-medium">View Queue</Link>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading queue tickets...</div>
              ) : data && recent.length === 0 ? (
                <div className="p-4 text-center text-muted">No recent tickets in queue.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {recent.map((t) => (
                    <li key={t.id} className="list-group-item p-3">
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
                        <Link to={`/staff/tickets/${t.id}`} className="fw-bold text-decoration-none" style={{ color: "var(--color-primary)" }}>
                          {t.ticketNumber}
                        </Link>
                        <div className="d-flex gap-1">
                          <span className={`badge ${priorityBadgeClass(t.itPriority)}`}>{t.itPriority}</span>
                          <span className={`badge ${statusBadgeClass(t.currentStatus)}`}>{formatStatus(t.currentStatus)}</span>
                        </div>
                      </div>
                      <div className="fw-medium text-truncate mb-1">{t.title}</div>
                      <div className="d-flex justify-content-between text-muted" style={{ fontSize: 12 }}>
                        <span>{t.ownerId ? "Assigned" : "Unassigned"}</span>
                        <span>Updated {new Date(t.updatedAt).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="col-12 col-lg-6" aria-labelledby="my-actions-heading">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: 12, overflow: "hidden" }}>
            <div className="card-header bg-white py-3 px-4">
              <h2 id="my-actions-heading" className="h5 mb-0 fw-bold">My Recent Actions Taken</h2>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading actions...</div>
              ) : data && actions.length === 0 ? (
                <div className="p-4 text-center text-muted">No actions recorded yet. Open a ticket to record your first service action.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {actions.map((a) => (
                    <li key={a.id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <Link to={`/staff/tickets/${a.ticketId}`} className="fw-bold text-decoration-none" style={{ color: "var(--color-primary)" }}>
                          {a.ticketNumber}
                        </Link>
                        {a.followUpRequired ? (
                          <span className="badge text-bg-warning">Follow-Up Required</span>
                        ) : (
                          <span className="badge text-bg-light border">Completed</span>
                        )}
                      </div>
                      <div className="text-muted mb-1" style={{ fontSize: 12 }}>{new Date(a.actionDateTime).toLocaleString()}</div>
                      <div className="mb-1" style={{ fontSize: 13 }}><strong>Action:</strong> {a.description}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}><strong>Result:</strong> {a.result}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
