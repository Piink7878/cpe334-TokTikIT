import { useState } from "react";
import { checkSystem, Category } from "./api";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  void categories; // Ignored for Issue 2

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
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="mt-4">
          <div className="alert alert-success mb-3">
            <strong>System Status:</strong> Online
          </div>
          <h5>Supported Request Categories:</h5>
          <ul className="list-group">
            {categories.map((cat) => (
              <li key={cat.id} className="list-group-item">
                {cat.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 alert alert-danger">
          <strong>System Status:</strong> Offline / Unable to connect to TokTickIT API <br />
          <small>{errorMsg}</small>
        </div>
      )}
    </div>
  );
}
