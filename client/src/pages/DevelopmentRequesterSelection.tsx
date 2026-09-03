import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRequester, Requester } from "../contexts/RequesterContext";
import { getRequesters } from "../api";

export default function DevelopmentRequesterSelection() {
  const navigate = useNavigate();
  const { setSelectedRequester } = useRequester();
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>("");

  useEffect(() => {
    getRequesters()
      .then((res) => {
        setRequesters(res.data);
        if (res.data.length > 0) {
          setSelectedValue(res.data[0].id.toString());
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load requesters");
        setLoading(false);
      });
  }, []);

  const handleContinue = () => {
    const selected = requesters.find(r => r.id.toString() === selectedValue);
    if (selected) {
      setSelectedRequester(selected);
      navigate("/my-tickets");
    }
  };

  return (
    <div className="container d-flex justify-content-center px-3" style={{ marginTop: 60, marginBottom: 60 }}>
      <div className="card shadow-sm w-100" style={{ maxWidth: 520, borderRadius: 8, borderColor: "var(--color-border-subtle)" }}>
        <div className="card-body p-4 text-center">
          <div 
            className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
            style={{ width: 64, height: 64, backgroundColor: "var(--color-pale-green)", color: "var(--color-primary)", fontSize: 24 }}
          >
            👤
          </div>
          <h2 className="mb-2" style={{ color: "var(--color-text-main)", fontSize: 22, fontWeight: 700 }}>
            Select Development Requester
          </h2>
          <p className="text-muted mb-4" style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Choose a development requester to simulate the current requester context for Lab 2. 
            This is for testing only and is not a login screen.
          </p>

          <div className="text-start mb-4">
            <label className="form-label" style={{ color: "var(--color-text-main)", fontWeight: 600, fontSize: 14 }}>
              Active Requesters <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            
            {loading && (
              <select className="form-select" disabled>
                <option>Loading active requesters...</option>
              </select>
            )}

            {error && (
              <div className="alert mt-2" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger)", color: "var(--color-danger)", fontSize: 14 }}>
                {error}
                <br />
                <button className="btn btn-sm mt-2" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }} onClick={() => window.location.reload()}>Retry</button>
              </div>
            )}

            {!loading && !error && requesters.length === 0 && (
              <div className="alert" style={{ backgroundColor: "var(--color-warning-bg)", borderColor: "var(--color-warning)", color: "var(--color-warning)", fontSize: 14 }}>
                No active development requesters found in database.
              </div>
            )}

            {!loading && !error && requesters.length > 0 && (
              <select 
                className="form-select" 
                value={selectedValue} 
                onChange={(e) => setSelectedValue(e.target.value)}
              >
                {requesters.map(req => (
                  <option key={req.id} value={req.id}>{req.name} ({req.email})</option>
                ))}
              </select>
            )}
          </div>

          <div className="alert text-start mb-4" style={{ backgroundColor: "var(--color-info-bg)", color: "var(--color-info)", border: "1px solid #BFDBFE", fontSize: 14 }}>
            <strong>Authentication coming in Lab 3:</strong> In Lab 3, this selection will be replaced with secure authentication so you can access the system with your own account.
          </div>

          <div className="d-flex justify-content-end">
            <button 
              className="btn btn-primary" 
              style={{ borderRadius: 6, padding: "8px 24px", fontWeight: 500 }}
              onClick={handleContinue}
              disabled={loading || !!error || requesters.length === 0}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
