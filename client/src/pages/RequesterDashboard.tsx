import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getRequesterDashboard, RequesterDashboardData } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { KpiCard, KpiSkeletons, DashboardError, ForbiddenCard, formatStatus, statusBadgeClass, priorityBadgeClass } from "../components/DashboardParts";

export default function RequesterDashboard() {
  const { user } = useAuth();
  const isRequester = user?.role === "REQUESTER";
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequesterDashboard();
      setData(res.data);
    } catch {
      setError("Unable to load dashboard metrics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRequester) fetchDashboard();
  }, [isRequester, fetchDashboard]);

  if (!isRequester) {
    return <ForbiddenCard dashboardName="Requester Dashboard" backTo="/" backLabel="Go to my home page" />;
  }

  const recent = data?.recentTickets ?? [];

  // Tickets waiting for the requester get an amber "needs your input" badge (ui-spec §2.1.3).
  const statusBadge = (status: string) =>
    status === "WAITING_FOR_REQUESTER" ? (
      <span className="badge" style={{ backgroundColor: "#FEF3C7", color: "#B45309", border: "1px solid #FCD34D" }} title="Requires your input">
        {formatStatus(status)}
      </span>
    ) : (
      <span className={`badge ${statusBadgeClass(status)}`}>{formatStatus(status)}</span>
    );

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-2 border-bottom">
        <div>
          <h1 className="h2 mb-1 fw-bold">Requester Dashboard</h1>
          <p className="mb-0 text-muted" style={{ fontSize: 14 }}>
            Track the status of your support requests and see which ones need your attention.
          </p>
        </div>
        <Link to="/my-tickets" className="btn btn-outline-success fw-medium mt-3 mt-md-0">My Tickets &rarr;</Link>
      </div>

      {error && <DashboardError message={error} onRetry={fetchDashboard} />}

      {loading ? (
        <KpiSkeletons />
      ) : data ? (
        <div className="row g-3 mb-4">
          <KpiCard title="Total Tickets" value={data.totalTickets} caption="All your submitted tickets" to="/my-tickets" />
          <KpiCard title="Active Tickets" value={data.activeTickets} caption="New, open and in progress" to="/my-tickets?status=NEW,OPEN,IN_PROGRESS" />
          <KpiCard title="Waiting for Me" value={data.waitingForRequesterTickets} caption="Needs your input" to="/my-tickets?status=WAITING_FOR_REQUESTER" />
          <KpiCard title="Resolved / Closed" value={data.resolvedOrClosedTickets} caption="Resolved or closed tickets" to="/my-tickets?status=RESOLVED,CLOSED" />
        </div>
      ) : null}

      <section className="card shadow-sm border-0" style={{ borderRadius: 12, overflow: "hidden" }} aria-labelledby="recent-tickets-heading">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <h2 id="recent-tickets-heading" className="h5 mb-0 fw-bold">Recent &amp; Attention-Required Tickets</h2>
          <Link to="/my-tickets" className="btn btn-sm btn-link text-decoration-none text-success fw-medium">View All My Tickets</Link>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">
              <div className="spinner-border spinner-border-sm me-2 text-success" role="status"></div>
              Loading recent tickets...
            </div>
          ) : data && recent.length === 0 ? (
            <div className="p-5 text-center">
              <p className="text-muted mb-3">No recent ticket activity. Submit a new ticket using the Create Ticket button.</p>
              <Link to="/create-ticket" className="btn btn-primary btn-sm">+ Create Ticket</Link>
            </div>
          ) : (
            <>
              <div className="table-responsive d-none d-lg-block">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light text-muted" style={{ fontSize: 13 }}>
                    <tr>
                      <th scope="col" className="ps-4">Ticket #</th>
                      <th scope="col">Title</th>
                      <th scope="col">Status</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Last Updated</th>
                      <th scope="col" className="text-end pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((t) => (
                      <tr key={t.id}>
                        <td className="ps-4 fw-semibold">
                          <Link to={`/tickets/${t.id}`} className="text-decoration-none" style={{ color: "var(--color-primary)" }}>{t.ticketNumber}</Link>
                        </td>
                        <td className="text-truncate" style={{ maxWidth: 300 }}>{t.title}</td>
                        <td>{statusBadge(t.currentStatus)}</td>
                        <td><span className={`badge ${priorityBadgeClass(t.itPriority)}`}>{t.itPriority}</span></td>
                        <td className="text-muted" style={{ fontSize: 13 }}>{new Date(t.updatedAt).toLocaleString()}</td>
                        <td className="text-end pe-4">
                          <Link to={`/tickets/${t.id}`} className="btn btn-sm btn-outline-primary" aria-label={`View ticket ${t.ticketNumber}`}>View Ticket</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="list-group list-group-flush d-lg-none">
                {recent.map((t) => (
                  <li key={t.id} className="list-group-item p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
                      <Link to={`/tickets/${t.id}`} className="fw-bold text-decoration-none" style={{ color: "var(--color-primary)" }}>{t.ticketNumber}</Link>
                      <div className="d-flex gap-1">
                        <span className={`badge ${priorityBadgeClass(t.itPriority)}`}>{t.itPriority}</span>
                        {statusBadge(t.currentStatus)}
                      </div>
                    </div>
                    <div className="fw-medium text-truncate">{t.title}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Updated {new Date(t.updatedAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
