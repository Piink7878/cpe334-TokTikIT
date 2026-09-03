import { Outlet, Link, useNavigate } from "react-router-dom";
import { useRequester } from "../contexts/RequesterContext";

export default function AppLayout() {
  const { selectedRequester, setSelectedRequester } = useRequester();
  const navigate = useNavigate();

  const handleChangeRequester = () => {
    setSelectedRequester(null);
    navigate("/");
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg border-bottom sticky-top" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border-subtle)" }}>
        <div className="container">
          <Link to="/my-tickets" className="navbar-brand fw-bold text-decoration-none" style={{ color: "var(--color-primary)" }}>
            TokTickIT
          </Link>
          
          <div className="collapse navbar-collapse">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link to="/my-tickets" className="nav-link" style={{ color: "var(--color-text-main)", fontWeight: 500 }}>My Tickets</Link>
              </li>
              <li className="nav-item">
                <Link to="/create-ticket" className="nav-link" style={{ color: "var(--color-text-main)", fontWeight: 500 }}>Create Ticket</Link>
              </li>
              <li className="nav-item">
                <Link to="/health" className="nav-link" style={{ color: "var(--color-text-muted)" }}>Health</Link>
              </li>
            </ul>
          </div>

          <div className="d-flex align-items-center">
            {selectedRequester && (
              <span className="me-3" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                <span className="badge me-2" style={{ backgroundColor: "var(--color-pale-green)", color: "var(--color-primary)" }}>Dev Mode</span>
                <span className="fw-medium">{selectedRequester.name}</span>
                <span className="text-muted ms-1 d-none d-md-inline">({selectedRequester.email})</span>
              </span>
            )}
            <button className="btn btn-sm btn-outline-secondary" onClick={handleChangeRequester}>
              Change Requester
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow-1" style={{ backgroundColor: "var(--color-bg-page)" }}>
        <Outlet />
      </main>
    </div>
  );
}
