const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export interface TicketFilters {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  itPriority?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface Attachment {
  id: number;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  isRemoved: boolean;
  removedAt: string | null;
  removedReason: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  description?: string;
  requester?: { id: number; name: string; email: string; department?: string };
  category: { id: number; name: string };
  relatedSystem?: { id: number; name: string };
  requestedPriority: string;
  itPriority: string;
  status: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
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

export async function getTickets(requesterId: number, filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  const queryString = params.toString();
  const url = `${API_URL}/api/tickets${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Requester-Id': requesterId.toString()
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch tickets");
  }

  return res.json();
}

export async function getTicket(ticketId: number, requesterId: number): Promise<{ data: Ticket }> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Requester-Id': requesterId.toString()
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch ticket");
  }

  return res.json();
}

export async function uploadAttachment(ticketId: number, file: File, requesterId: number) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: {
      "X-Requester-Id": requesterId.toString()
    },
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to upload attachment");
  }

  return res.json();
}

export async function removeAttachment(attachmentId: number, reason: string, requesterId: number) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": requesterId.toString()
    },
    body: JSON.stringify({ removalReason: reason })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to remove attachment");
  }

  return res.json();
}

export async function downloadAttachment(attachmentId: number, originalFilename: string, requesterId: number) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: {
      "X-Requester-Id": requesterId.toString()
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to download attachment");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = originalFilename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
