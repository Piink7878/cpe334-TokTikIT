const API_URL = import.meta.env.VITE_API_URL ?? "";

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
    resHealth = await fetch(`${API_URL}/api/health`, { credentials: "include" });
  } catch (error) {
    throw new Error("Backend is unreachable (Network Error). Please ensure the server is running.");
  }

  if (!resHealth.ok) {
    throw new Error(`Failed to fetch health check: ${resHealth.statusText}`);
  }

  try {
    resCategories = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
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
  const res = await fetch(`${API_URL}/api/requesters`, { credentials: "include" });
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
  const res = await fetch(`${API_URL}/api/related-systems`, { credentials: "include" });
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

export async function createTicket(formData: FormData) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    credentials: "include",
    method: "POST",
    headers: {},
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to create ticket");
  }
  return res.json();
}

export async function getTickets(filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> {
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
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch tickets");
  }

  return res.json();
}

export async function getTicket(ticketId: number): Promise<{ data: Ticket }> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch ticket");
  }

  return res.json();
}

export async function uploadAttachment(ticketId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    credentials: "include",
    method: "POST",
    headers: {},
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to upload attachment");
  }

  return res.json();
}

export async function removeAttachment(attachmentId: number, reason: string) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    credentials: "include",
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removalReason: reason })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to remove attachment");
  }

  return res.json();
}

export async function downloadAttachment(attachmentId: number, originalFilename: string) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: {}
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

export interface StaffTicketFilters {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  itPriority?: string;
  status?: string;
  ownerId?: string | 'unassigned';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StaffTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { id: number; name: string };
  requestedPriority: string;
  itPriority: string;
  status: string;
  requester: { id: number; name: string };
  owner: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function getStaffTickets(filters?: StaffTicketFilters): Promise<PaginatedResponse<StaffTicket>> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  const queryString = params.toString();
  const url = `${API_URL}/api/staff/tickets${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch staff tickets");
  }

  return res.json();
}

export async function getStaffAssignees() {
  const res = await fetch(`${API_URL}/api/staff/assignees`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch assignees");
  }

  return res.json();
}

export async function getStaffTicketDetail(ticketId: number) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch ticket details");
  }

  return res.json();
}

export async function claimTicket(ticketId: number) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/claim`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to claim ticket");
  }

  return res.json();
}

export async function assignTicket(ticketId: number, assigneeId: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/assign`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigneeId })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to assign ticket");
  }

  return res.json();
}

export async function updateTicketPriority(ticketId: number, itPriority: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/priority`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itPriority })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to update priority");
  }

  return res.json();
}

export async function updateTicketStatus(ticketId: number, status: string, rejectionReason?: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, rejectionReason })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to update status");
  }

  return res.json();
}

