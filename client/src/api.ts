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
  const resHealth = await fetch(`${API_URL}/api/health`);
  if (!resHealth.ok) {
    throw new Error(`Failed to fetch health check: ${resHealth.statusText}`);
  }
  
  const resCategories = await fetch(`${API_URL}/api/categories`);
  if (!resCategories.ok) {
    throw new Error(`Failed to fetch categories: ${resCategories.statusText}`);
  }
  
  const categories = await resCategories.json();
  
  return { online: true, categories };
}
