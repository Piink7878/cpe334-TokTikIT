import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { checkSystem, Category } from "./api";
import DevelopmentRequesterSelection from "./pages/DevelopmentRequesterSelection";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import MyTickets from "./pages/MyTickets";
import CreateTicket from "./pages/CreateTicket";
import { RequesterTicketDetail } from "./pages/RequesterTicketDetail";

// UI states for Health Check (Issue 4)
type UiState = "idle" | "loading" | "success" | "error";

function HealthCheck() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await checkSystem();
      setCategories(res.categories);
      setState("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to the backend");
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span style={{ color: "var(--color-secondary)" }}>IT Service Desk Health</span>
      </h1>

      <button className="btn btn-primary" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? (
          <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...</span>
        ) : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-4">
          <div className="alert alert-success mb-3" style={{ backgroundColor: "var(--color-pale-green)", borderColor: "var(--color-secondary)", color: "var(--color-primary)" }}>
            <strong>System Status:</strong> Online
          </div>
          <h5 style={{ color: "var(--color-text-main)" }}>Supported Request Categories:</h5>
          {categories.length === 0 ? (
            <p className="text-muted mt-2">No categories available</p>
          ) : (
            <ul className="list-group">
              {categories.map((cat) => (
                <li key={cat.id} className="list-group-item">
                  {cat.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 alert alert-danger" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          <strong>System Status:</strong> Offline / Unable to connect to TokTickIT API <br />
          <small>{errorMsg}</small>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DevelopmentRequesterSelection />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/create-ticket" element={<CreateTicket />} />
            <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
            <Route path="/health" element={<HealthCheck />} />
            {/* Catch-all for unknown protected routes */}
            <Route path="*" element={<Navigate to="/my-tickets" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
