import { Navigate, Outlet } from "react-router-dom";
import { useRequester } from "../contexts/RequesterContext";

export default function ProtectedRoute() {
  const { selectedRequester } = useRequester();

  if (!selectedRequester) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
