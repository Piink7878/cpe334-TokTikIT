import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        logout();
        navigate("/login");
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
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
                <NavLink to="/my-tickets" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>My Tickets</NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/create-ticket" className={({isActive}) => `nav-link ${isActive ? 'fw-bold' : ''}`} style={({isActive}) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-main)", fontWeight: isActive ? 700 : 500 })}>Create Ticket</NavLink>
              </li>
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
