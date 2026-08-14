import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;

  const [errorMsg, setErrorMsg] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorMsg("");
    try {
      const status = await checkSystem();
      if (status.online) {
        setCategories(status.categories);
        setState("success");
      }
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Failed to connect to the backend");
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

      <div className="mt-4">
        {state === "success" && (
          <div className="alert alert-success">
            <strong>Status:</strong> Online
          </div>
        )}
        {state === "error" && (
          <div className="alert alert-danger">
            <strong>Status:</strong> Offline - {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
