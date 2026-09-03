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

export async function getRequesters() {
  const res = await fetch(`${API_URL}/api/requesters`);
  if (!res.ok) {
    throw new Error("Failed to fetch requesters");
  }
  return res.json();
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function getRelatedSystems() {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to fetch related systems");
  }
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }
  // The API returns the array directly for categories
  return res.json();
}

export async function createTicket(formData: FormData, requesterId: number) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "X-Requester-Id": requesterId.toString()
    },
    body: formData
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to create ticket");
  }
  return res.json();
}
