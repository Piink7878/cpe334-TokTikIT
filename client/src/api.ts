const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}
// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  let resHealth;
  let resCategories;
  
  try {
    resHealth = await fetch(`${API_URL}/api/health`);
  } catch (error) {
    throw new Error("Backend is unreachable (Network Error). Please ensure the server is running.");
  }
  
  if (!resHealth.ok) {
    throw new Error(`Failed to fetch health check: ${resHealth.statusText}`);
  }
  
  try {
    resCategories = await fetch(`${API_URL}/api/categories`);
  } catch (error) {
    throw new Error("Failed to reach categories endpoint (Network Error).");
  }
  
  if (!resCategories.ok) {
    throw new Error(`Failed to fetch categories: ${resCategories.statusText}`);
  }
  
  const categories = await resCategories.json();
  
  return { online: true, categories };
}
