import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // The collapsed (tablet / mobile) menu closes after navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { credentials: "include", method: "POST" });
    } catch (err) {
      console.error("Logout request failed", err);
    }
    // Leave regardless of the server's answer: an expired session (401) or a network failure must not trap the user.
    logout();
    navigate("/login");
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg border-bottom sticky-top" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border-subtle)" }}>
        <div className="container">
          <Link to="/" className="navbar-brand fw-bold text-decoration-none" style={{ color: "var(--color-primary)" }}>
            TokTickIT
          </Link>
          
          <button
            type="button"
            className="navbar-toggler ms-auto me-2"
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div id="main-nav" className={`collapse navbar-collapse${menuOpen ? " show" : ""}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {user?.role === "REQUESTER" && (
                <>
                  <li className="nav-item">
                    <NavLink to="/requester-dashboard" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Dashboard</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/my-tickets" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>My Tickets</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/create-ticket" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Create Ticket</NavLink>
                  </li>
                </>
              )}
              {user?.role === "IT_STAFF" && (
                <>
                  <li className="nav-item">
                    <NavLink to="/staff-dashboard" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Dashboard</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/staff-queue" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Ticket Queue</NavLink>
                  </li>
                </>
              )}
              {user?.role === "ADMIN" && (
                <>
                  <li className="nav-item">
                    <NavLink to="/staff-dashboard" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Staff Dashboard</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/staff-queue" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Ticket Queue</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/user-management" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>User Management</NavLink>
                  </li>
                </>
              )}
              <li className="nav-item">
                <NavLink to="/health" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" })}>Health</NavLink>
              </li>
            </ul>
          </div>

          <div className="d-flex align-items-center">
            {user && (
              <span className="me-3" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                <span className="badge me-2" style={{ backgroundColor: "var(--color-pale-green)", color: "var(--color-primary)" }}>{user.role}</span>
                <span className="fw-medium">{user.fullName}</span>
                <span className="text-muted ms-1 d-none d-md-inline">({user.email})</span>
              </span>
            )}
            <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
              Logout
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
