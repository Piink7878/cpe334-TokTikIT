import React from "react";
import { Link } from "react-router-dom";

// Shared building blocks for the Requester and IT Staff dashboards (Lab 4, FR-15/FR-16).

interface KpiCardProps {
  title: string;
  value: number;
  caption: string;
  to: string;
}

// The whole card is the link (ui-spec §2.1.4); its accessible name is its visible text (title, value, caption).
export function KpiCard({ title, value, caption, to }: KpiCardProps) {
  return (
    <div className="col-12 col-sm-6 col-lg-3">
      <Link to={to} className="card text-decoration-none h-100 kpi-card">
        <div className="card-body p-4">
          <div className="text-muted fw-semibold mb-2" style={{ fontSize: 14 }}>{title}</div>
          <div className="kpi-value mb-2">{value}</div>
          <div className="text-muted" style={{ fontSize: 13 }}>{caption} <span aria-hidden="true">&rarr;</span></div>
        </div>
      </Link>
    </div>
  );
}

export function KpiSkeletons() {
  return (
    <div className="row g-3 mb-4" aria-busy="true" aria-label="Loading metrics">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="col-12 col-sm-6 col-lg-3">
          <div className="card kpi-card kpi-skeleton placeholder-glow p-4 text-center h-100">
            <span className="placeholder col-6 mb-3 mx-auto"></span>
            <span className="placeholder col-4 py-3 mx-auto"></span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4 shadow-sm" role="alert">
      <div>{message}</div>
      <button className="btn btn-sm btn-outline-danger ms-3" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function ForbiddenCard({ dashboardName, backTo, backLabel }: { dashboardName: string; backTo: string; backLabel: string }) {
  return (
    <div className="container py-5">
      <div className="card border-danger shadow-sm mx-auto" style={{ maxWidth: 600 }}>
        <div className="card-body p-4 text-center">
          <h1 className="h4 text-danger fw-bold">403 Forbidden</h1>
          <p className="text-muted">You do not have permission to access the {dashboardName}.</p>
          <Link to={backTo} className="btn btn-outline-secondary">{backLabel}</Link>
        </div>
      </div>
    </div>
  );
}

export const formatStatus = (status: string) => status.replace(/_/g, " ");

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "NEW": return "text-bg-success";
    case "OPEN": return "text-bg-primary";
    case "IN_PROGRESS": return "text-bg-warning";
    case "WAITING_FOR_REQUESTER": return "text-bg-info";
    case "RESOLVED": return "text-bg-dark";
    case "CLOSED": return "text-bg-secondary";
    case "REOPENED": return "text-bg-warning";
    case "CANCELLED":
    case "REJECTED": return "text-bg-danger";
    default: return "text-bg-light";
  }
}

export function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "CRITICAL": return "text-bg-danger";
    case "HIGH": return "text-bg-warning";
    case "MEDIUM": return "text-bg-primary";
    case "LOW": return "text-bg-info";
    default: return "text-bg-secondary";
  }
}
