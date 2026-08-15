import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { checkSystem } from "./api.js";
export default function App() {
    const [state, setState] = useState("idle");
    const [categories, setCategories] = useState([]);
    const [errorMsg, setErrorMsg] = useState("");
    void categories; // Ignored for Issue 2
    async function handleCheck() {
        setState("loading");
        setErrorMsg("");
        try {
            const res = await checkSystem();
            setCategories(res.categories);
            setState("success");
        }
        catch (err) {
            setErrorMsg(err.message || "Failed to connect to the backend");
            setState("error");
        }
    }
    return (_jsxs("div", { className: "container py-5", style: { maxWidth: 640 }, children: [_jsxs("h1", { className: "h3 mb-4", children: ["TokTickIT ", _jsx("span", { className: "text-success", children: "IT Service Desk" })] }), _jsx("button", { className: "btn btn-success", onClick: handleCheck, disabled: state === "loading", children: state === "loading" ? "Loading…" : "Check System" }), state === "success" && (_jsxs("div", { className: "mt-4 alert alert-success", children: [_jsx("strong", { children: "Status:" }), " Online"] })), state === "error" && (_jsxs("div", { className: "mt-4 alert alert-danger", children: [_jsx("strong", { children: "Status:" }), " Offline ", _jsx("br", {}), _jsx("small", { children: errorMsg })] }))] }));
}
